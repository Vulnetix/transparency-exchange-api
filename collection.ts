import { Context, CreateTeaCollectionRequest } from "@shared/interfaces";

export const onRequestPost = async (context: Context) => {
    const { data, request } = context;
    
    try {
        // Authenticate user
        if (!data.session?.memberUuid || !data.session?.orgId) {
            return new Response(JSON.stringify({ error: `Authentication required` }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parse request body (data.json is already parsed by middleware)
        const requestBody: CreateTeaCollectionRequest = data.json;
        
        // Validate required fields
        if (!requestBody.releaseIdentifier) {
            return new Response(JSON.stringify({ error: `Missing required field: releaseIdentifier` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!requestBody.updateReason || !requestBody.updateReason.type) {
            return new Response(JSON.stringify({ error: `Missing required field: updateReason.type` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate release UUID format
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestBody.releaseIdentifier)) {
            return new Response(JSON.stringify({ error: `Invalid release UUID format` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if release exists and belongs to the organization
        const existingRelease = await data.prisma.teaRelease.findUnique({
            where: {
                uuid: requestBody.releaseIdentifier
            },
            include: {
                product: true
            }
        });

        if (!existingRelease) {
            return new Response(JSON.stringify({ error: `Release not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (existingRelease.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied to release` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Generate UUID for the collection
        const collectionUuid = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        // Create TEA Collection in database
        const teaCollection = await data.prisma.teaCollection.create({
            data: {
                uuid: collectionUuid,
                name: `Collection for ${existingRelease.product.name} v${existingRelease.version}`,
                description: `Collection created for release ${requestBody.releaseIdentifier}. Update reason: ${requestBody.updateReason.type}${requestBody.updateReason.comment ? ` - ${requestBody.updateReason.comment}` : ``}`,
                artifacts: JSON.stringify(requestBody.artifacts || []),
                lifecycle: JSON.stringify({
                    phase: `created`,
                    startedOn: new Date().toISOString(),
                    description: `Collection created for release`
                }),
                orgId: data.session.orgId,
                createdAt: now,
                updatedAt: now
            }
        });

        // Link the product to the collection
        await data.prisma.teaCollection.update({
            where: {
                uuid: collectionUuid
            },
            data: {
                products: {
                    connect: {
                        uuid: existingRelease.productUuid
                    }
                }
            }
        });

        // Build response
        const response = {
            identifier: teaCollection.uuid,
            name: teaCollection.name,
            description: teaCollection.description,
            artifacts: JSON.parse(teaCollection.artifacts || `[]`),
            lifecycle: JSON.parse(teaCollection.lifecycle || `{}`),
            products: [existingRelease.productUuid]
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error creating TEA Collection:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const onRequestGet = async (context: Context) => {
    const { data } = context;
    
    try {
        // Authenticate user
        if (!data.session?.memberUuid || !data.session?.orgId) {
            return new Response(JSON.stringify({ error: `Authentication required` }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parse query parameters
        const url = new URL(context.request.url);
        const pageOffset = parseInt(url.searchParams.get('pageOffset') || '0');
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '100'), 1000);

        // Build where clause
        const where = {
            orgId: data.session.orgId
        };

        // Get total count
        const total = await data.prisma.teaCollection.count({ where });

        // Get collections with pagination
        const collections = await data.prisma.teaCollection.findMany({
            where,
            skip: pageOffset,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                products: {
                    select: {
                        uuid: true
                    }
                }
            }
        });

        // Transform to API format
        const collectionData = collections.map(collection => {
            const lifecycle = JSON.parse(collection.lifecycle || '{}');
            const artifacts = JSON.parse(collection.artifacts || '[]');
            
            return {
                uuid: collection.uuid,
                version: 1, // Default version for now
                releaseDate: new Date(collection.createdAt * 1000).toISOString(),
                updateReason: {
                    type: 'INITIAL_RELEASE',
                    comment: collection.description || ''
                },
                artifacts: artifacts
            };
        });

        const response = {
            data: collectionData,
            pagination: {
                total,
                pageOffset,
                pageSize,
                hasNext: pageOffset + pageSize < total,
                hasPrevious: pageOffset > 0
            }
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error fetching TEA Collections:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
