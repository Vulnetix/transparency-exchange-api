import { Context, UpdateTeaCollectionRequest } from "@shared/interfaces";

export const onRequestGet = async (context: Context) => {
    const { data, params } = context;
    
    try {
        // Authenticate user
        if (!data.session?.memberUuid || !data.session?.orgId) {
            return new Response(JSON.stringify({ error: `Authentication required` }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const collectionUuid = params.uuid as string;
        
        // Validate UUID format
        if (!collectionUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionUuid)) {
            return new Response(JSON.stringify({ error: `Invalid collection UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get collection with related data
        const collection = await data.prisma.teaCollection.findUnique({
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

        if (collection.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Transform to API format
        const lifecycle = JSON.parse(collection.lifecycle || '{}');
        const artifacts = JSON.parse(collection.artifacts || '[]');
        
        const response = {
            uuid: collection.uuid,
            version: 1, // Default version for now
            releaseDate: new Date(collection.createdAt * 1000).toISOString(),
            updateReason: {
                type: 'INITIAL_RELEASE',
                comment: collection.description || ''
            },
            artifacts: artifacts
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

export const onRequestPatch = async (context: Context) => {
    const { data, params } = context;
    
    try {
        // Authenticate user
        if (!data.session?.memberUuid || !data.session?.orgId) {
            return new Response(JSON.stringify({ error: `Authentication required` }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const collectionUuid = params.uuid as string;
        
        // Validate UUID format
        if (!collectionUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionUuid)) {
            return new Response(JSON.stringify({ error: `Invalid collection UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if collection exists and belongs to the organization
        const existingCollection = await data.prisma.teaCollection.findUnique({
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

        if (existingCollection.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parse request body
        const requestBody: UpdateTeaCollectionRequest = data.json;
        
        // Build update data
        const updateData: any = {
            updatedAt: Math.floor(Date.now() / 1000)
        };

        if (requestBody.name !== undefined) updateData.name = requestBody.name;
        if (requestBody.description !== undefined) updateData.description = requestBody.description;
        if (requestBody.artifacts !== undefined) updateData.artifacts = JSON.stringify(requestBody.artifacts);
        if (requestBody.lifecycle !== undefined) updateData.lifecycle = JSON.stringify(requestBody.lifecycle);

        // Update TEA Collection in database
        const updatedCollection = await data.prisma.teaCollection.update({
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
        
        const response = {
            uuid: updatedCollection.uuid,
            version: 1, // Default version for now
            releaseDate: new Date(updatedCollection.createdAt * 1000).toISOString(),
            updateReason: {
                type: 'ARTIFACT_UPDATED',
                comment: updatedCollection.description || ''
            },
            artifacts: artifacts
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

export const onRequestDelete = async (context: Context) => {
    const { data, params } = context;
    
    try {
        // Authenticate user
        if (!data.session?.memberUuid || !data.session?.orgId) {
            return new Response(JSON.stringify({ error: `Authentication required` }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const collectionUuid = params.uuid as string;
        
        // Validate UUID format
        if (!collectionUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionUuid)) {
            return new Response(JSON.stringify({ error: `Invalid collection UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if collection exists and belongs to the organization
        const existingCollection = await data.prisma.teaCollection.findUnique({
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

        if (existingCollection.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Delete the collection (this will also remove product relationships due to the many-to-many setup)
        await data.prisma.teaCollection.delete({
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
