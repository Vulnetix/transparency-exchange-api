import type { CreateTeaCollectionRequest, TeaLifecycle } from "./types";
import type { PrismaClient } from "@prisma/client";

// Helper function to create initial lifecycle
function createInitialLifecycle(releaseIdentifier: string): TeaLifecycle {
    return {
        phase: 'created',
        name: 'Collection Created',
        description: `Collection created for release ${releaseIdentifier}`,
        startedOn: new Date().toISOString(),
        completedOn: null,
        lastUpdated: new Date().toISOString()
    };
}

// Helper function to transition lifecycle phases
function transitionLifecycle(currentLifecycle: TeaLifecycle, newPhase: TeaLifecycle['phase'], description?: string): TeaLifecycle {
    const now = new Date().toISOString();
    return {
        ...currentLifecycle,
        phase: newPhase,
        name: getPhaseDisplayName(newPhase),
        description: description || currentLifecycle.description,
        lastUpdated: now,
        completedOn: (newPhase === 'completed' || newPhase === 'archived' || newPhase === 'deprecated') ? now : currentLifecycle.completedOn
    };
}

// Helper function to get display name for lifecycle phases
function getPhaseDisplayName(phase: TeaLifecycle['phase']): string {
    switch (phase) {
        case 'created': return 'Collection Created';
        case 'in-progress': return 'In Progress';
        case 'updated': return 'Updated';
        case 'completed': return 'Completed';
        case 'archived': return 'Archived';
        case 'deprecated': return 'Deprecated';
        default: return 'Unknown Phase';
    }
}

export async function onRequestPost<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, request } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {
        // Parse request body (data.json is already parsed by middleware)
        const requestBody: CreateTeaCollectionRequest = await request.json();
        
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
        const existingRelease = await prisma.teaRelease.findUnique({
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
        // Generate UUID for the collection
        const collectionUuid = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        // Create TEA Collection in database
        const teaCollection = await prisma.teaCollection.create({
            data: {
                uuid: collectionUuid,
                name: `Collection for ${existingRelease.product.name} v${existingRelease.version}`,
                description: `Collection created for release ${requestBody.releaseIdentifier}. Update reason: ${requestBody.updateReason.type}${requestBody.updateReason.comment ? ` - ${requestBody.updateReason.comment}` : ``}`,
                artifacts: JSON.stringify(requestBody.artifacts || []),
                lifecycle: JSON.stringify(createInitialLifecycle(requestBody.releaseIdentifier)),
                createdAt: now,
                updatedAt: now
            }
        });

        // Link the product to the collection
        await prisma.teaCollection.update({
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

export async function onRequestGet<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        // Parse query parameters
        const url = new URL(context.request.url);
        const pageOffset = parseInt(url.searchParams.get('pageOffset') || '0');
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '100'), 1000);

        // Build where clause
        const where = {};

        // Get total count
        const total = await prisma.teaCollection.count({ where });

        // Get collections with pagination
        const collections = await prisma.teaCollection.findMany({
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
                name: collection.name,
                description: collection.description,
                version: 1, // Default version for now
                releaseDate: new Date(collection.createdAt * 1000).toISOString(),
                updateReason: {
                    type: 'INITIAL_RELEASE',
                    comment: collection.description || ''
                },
                artifacts: artifacts,
                lifecycle: lifecycle,
                products: collection.products.map(p => p.uuid)
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
