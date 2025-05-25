import type { UpdateTeaCollectionRequest, TeaLifecycle } from "../types";
import type { PrismaClient } from "@prisma/client";

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

// Helper function to validate lifecycle phase transitions
function isValidPhaseTransition(currentPhase: TeaLifecycle['phase'], newPhase: TeaLifecycle['phase']): boolean {
    const validTransitions: Record<TeaLifecycle['phase'], TeaLifecycle['phase'][]> = {
        'created': ['in-progress', 'completed', 'archived'],
        'in-progress': ['updated', 'completed', 'archived'],
        'updated': ['in-progress', 'completed', 'archived'],
        'completed': ['archived', 'deprecated'],
        'archived': ['deprecated'],
        'deprecated': [] // Final state, no transitions allowed
    };
    
    return validTransitions[currentPhase]?.includes(newPhase) || false;
}

export async function onRequestGet<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, params } = context;
    const prisma = data.prisma as PrismaClient;

    try {
        const collectionUuid = params.uuid as string;
        
        // Validate UUID format
        if (!collectionUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionUuid)) {
            return new Response(JSON.stringify({ error: `Invalid collection UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get collection with related data
        const collection = await prisma.teaCollection.findUnique({
            where: {
                uuid: collectionUuid
            },
            include: {
                products: {
                    select: {
                        uuid: true
                    }
                }
            }
        });

        if (!collection) {
            return new Response(JSON.stringify({ error: `Collection not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Transform to API format
        const lifecycle = JSON.parse(collection.lifecycle || '{}');
        const artifacts = JSON.parse(collection.artifacts || '[]');
        
        const response = {
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

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error fetching TEA Collection:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export async function onRequestPatch<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, params, request } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        const collectionUuid = params.uuid as string;
        
        // Validate UUID format
        if (!collectionUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionUuid)) {
            return new Response(JSON.stringify({ error: `Invalid collection UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if collection exists and belongs to the organization
        const existingCollection = await prisma.teaCollection.findUnique({
            where: {
                uuid: collectionUuid
            }
        });

        if (!existingCollection) {
            return new Response(JSON.stringify({ error: `Collection not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parse request body
        const requestBody: UpdateTeaCollectionRequest = await request.json();
        
        // Build update data
        const updateData: any = {
            updatedAt: Math.floor(Date.now() / 1000)
        };

        if (requestBody.name !== undefined) updateData.name = requestBody.name;
        if (requestBody.description !== undefined) updateData.description = requestBody.description;
        if (requestBody.artifacts !== undefined) updateData.artifacts = JSON.stringify(requestBody.artifacts);
        
        // Handle lifecycle updates with proper state transitions
        if (requestBody.lifecycle !== undefined) {
            const currentLifecycle = JSON.parse(existingCollection.lifecycle || '{}');
            const newLifecycle = transitionLifecycle(
                currentLifecycle, 
                requestBody.lifecycle.phase,
                requestBody.lifecycle.description
            );

            // Validate the phase transition
            if (!isValidPhaseTransition(currentLifecycle.phase, requestBody.lifecycle.phase)) {
                return new Response(JSON.stringify({ error: `Invalid lifecycle phase transition` }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            updateData.lifecycle = JSON.stringify(newLifecycle);
        } else if (requestBody.artifacts !== undefined) {
            // If artifacts are being updated, update lifecycle to reflect this
            const currentLifecycle = JSON.parse(existingCollection.lifecycle || '{}');
            const updatedLifecycle = transitionLifecycle(
                currentLifecycle,
                'updated',
                'Collection artifacts have been updated'
            );
            updateData.lifecycle = JSON.stringify(updatedLifecycle);
        }

        // Update TEA Collection in database
        const updatedCollection = await prisma.teaCollection.update({
            where: {
                uuid: collectionUuid
            },
            data: updateData,
            include: {
                products: {
                    select: {
                        uuid: true
                    }
                }
            }
        });

        // Build response
        const lifecycle = JSON.parse(updatedCollection.lifecycle || '{}');
        const artifacts = JSON.parse(updatedCollection.artifacts || '[]');
        
        // Determine update reason based on what was changed
        let updateReasonType = 'COLLECTION_UPDATED';
        if (requestBody.artifacts !== undefined) {
            updateReasonType = 'ARTIFACT_UPDATED';
        } else if (requestBody.lifecycle !== undefined) {
            updateReasonType = 'LIFECYCLE_UPDATED';
        } else if (requestBody.name !== undefined || requestBody.description !== undefined) {
            updateReasonType = 'METADATA_UPDATED';
        }
        
        const response = {
            uuid: updatedCollection.uuid,
            name: updatedCollection.name,
            description: updatedCollection.description,
            version: 1, // Default version for now
            releaseDate: new Date(updatedCollection.createdAt * 1000).toISOString(),
            updateReason: {
                type: updateReasonType,
                comment: updatedCollection.description || ''
            },
            artifacts: artifacts,
            lifecycle: lifecycle,
            products: updatedCollection.products.map(p => p.uuid)
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error updating TEA Collection:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export async function onRequestDelete<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, params } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        const collectionUuid = params.uuid as string;
        
        // Validate UUID format
        if (!collectionUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionUuid)) {
            return new Response(JSON.stringify({ error: `Invalid collection UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if collection exists and belongs to the organization
        const existingCollection = await prisma.teaCollection.findUnique({
            where: {
                uuid: collectionUuid
            }
        });

        if (!existingCollection) {
            return new Response(JSON.stringify({ error: `Collection not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Delete the collection (this will also remove product relationships due to the many-to-many setup)
        await prisma.teaCollection.delete({
            where: {
                uuid: collectionUuid
            }
        });

        return new Response(null, {
            status: 204
        });

    } catch (error) {
        console.error(`Error deleting TEA Collection:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
