import { Context, CreateTeaReleaseRequest } from "@shared/interfaces";

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
        const requestBody: CreateTeaReleaseRequest = data.json;
        
        // Validate required fields
        if (!requestBody.componentIdentifier) {
            return new Response(JSON.stringify({ error: `Missing required field: componentIdentifier` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!requestBody.version) {
            return new Response(JSON.stringify({ error: `Missing required field: version` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!requestBody.releaseDate) {
            return new Response(JSON.stringify({ error: `Missing required field: releaseDate` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate UUID format for componentIdentifier
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestBody.componentIdentifier)) {
            return new Response(JSON.stringify({ error: `Invalid component UUID format` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if component exists and belongs to the organization
        const existingComponent = await data.prisma.teaComponent.findUnique({
            where: {
                uuid: requestBody.componentIdentifier
            }
        });

        if (!existingComponent) {
            return new Response(JSON.stringify({ error: `Component not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (existingComponent.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied to component` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Find the product that owns this component
        const productComponent = await data.prisma.teaProductComponent.findFirst({
            where: {
                componentUuid: requestBody.componentIdentifier
            },
            include: {
                product: true
            }
        });

        if (!productComponent) {
            return new Response(JSON.stringify({ error: `Component not associated with any product` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Generate UUID for the release
        const releaseUuid = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        // Create TEA Release in database
        const teaRelease = await data.prisma.teaRelease.create({
            data: {
                uuid: releaseUuid,
                productUuid: productComponent.productUuid,
                tag: `v${requestBody.version}`, // Generate tag from version
                version: requestBody.version,
                name: null,
                description: null,
                releaseDate: requestBody.releaseDate,
                validUntilDate: null,
                prerelease: requestBody.preRelease || false,
                draft: false,
                orgId: data.session.orgId,
                createdAt: now,
                updatedAt: now
            }
        });

        // Create the release-component relationship
        await data.prisma.teaReleaseComponent.create({
            data: {
                releaseUuid: releaseUuid,
                componentUuid: requestBody.componentIdentifier,
                relationship: `release`,
                createdAt: now
            }
        });

        // Build response
        const response = {
            identifier: teaRelease.uuid,
            productUuid: teaRelease.productUuid,
            tag: teaRelease.tag,
            version: teaRelease.version,
            name: teaRelease.name,
            description: teaRelease.description,
            releaseDate: teaRelease.releaseDate,
            validUntilDate: teaRelease.validUntilDate,
            prerelease: teaRelease.prerelease,
            draft: teaRelease.draft,
            components: [requestBody.componentIdentifier] // Include the component this release is for
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error creating TEA Release:`, error);
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
        const idType = url.searchParams.get('idType');
        const idValue = url.searchParams.get('idValue');

        // Build where clause
        const where: any = {
            orgId: data.session.orgId
        };

        // For releases, we need to check component identifiers if filtering by idType/idValue
        if (idType && idValue) {
            // Find components with matching identifiers
            const matchingComponents = await data.prisma.teaComponent.findMany({
                where: {
                    orgId: data.session.orgId,
                    identifiers: {
                        contains: JSON.stringify({ idType, idValue })
                    }
                },
                select: { uuid: true }
            });

            const componentUuids = matchingComponents.map(c => c.uuid);
            
            if (componentUuids.length > 0) {
                where.components = {
                    some: {
                        componentUuid: {
                            in: componentUuids
                        }
                    }
                };
            } else {
                // No matching components, return empty result
                const response = {
                    data: [],
                    pagination: {
                        total: 0,
                        pageOffset,
                        pageSize,
                        hasNext: false,
                        hasPrevious: false
                    }
                };
                return new Response(JSON.stringify(response), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Get total count
        const total = await data.prisma.teaRelease.count({ where });

        // Get releases with pagination
        const releases = await data.prisma.teaRelease.findMany({
            where,
            skip: pageOffset,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                components: {
                    select: {
                        componentUuid: true,
                        component: {
                            select: {
                                identifiers: true
                            }
                        }
                    }
                },
                product: {
                    select: {
                        collections: {
                            select: {
                                uuid: true
                            }
                        }
                    }
                }
            }
        });

        // Transform to API format
        const releaseData = releases.map(release => {
            // Collect all identifiers from associated components
            const allIdentifiers: any[] = [];
            release.components.forEach(rc => {
                const componentIdentifiers = JSON.parse(rc.component.identifiers || '[]');
                allIdentifiers.push(...componentIdentifiers);
            });

            return {
                uuid: release.uuid,
                version: release.version || '',
                releaseDate: release.releaseDate || new Date().toISOString(),
                preRelease: release.prerelease || false,
                identifiers: allIdentifiers,
                collectionReferences: release.product.collections.map(c => c.uuid)
            };
        });

        const response = {
            data: releaseData,
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
        console.error(`Error fetching TEA Releases:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
