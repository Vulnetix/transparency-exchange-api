import { Context, UpdateTeaComponentRequest } from "@shared/interfaces";

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

        const componentUuid = params.uuid as string;
        
        // Validate UUID format
        if (!componentUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(componentUuid)) {
            return new Response(JSON.stringify({ error: `Invalid component UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if component exists and belongs to the organization
        const existingComponent = await data.prisma.teaComponent.findUnique({
            where: {
                uuid: componentUuid
            }
        });

        if (!existingComponent) {
            return new Response(JSON.stringify({ error: `Component not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (existingComponent.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parse request body
        const requestBody: UpdateTeaComponentRequest = data.json;
        
        // Build update data
        const updateData: any = {
            updatedAt: Math.floor(Date.now() / 1000)
        };

        if (requestBody?.name) updateData.name = requestBody.name;
        if (requestBody?.barcode !== undefined) updateData.barcode = requestBody.barcode;
        if (requestBody?.sku !== undefined) updateData.sku = requestBody.sku;
        if (requestBody?.vendor !== undefined) updateData.vendor = requestBody.vendor;
        if (requestBody?.identifiers) updateData.identifiers = JSON.stringify(requestBody.identifiers);
        if (requestBody?.type) updateData.type = requestBody.type;
        if (requestBody?.namespace !== undefined) updateData.namespace = requestBody.namespace;
        if (requestBody?.version !== undefined) updateData.version = requestBody.version;
        if (requestBody?.qualifiers) updateData.qualifiers = JSON.stringify(requestBody.qualifiers);
        if (requestBody?.subpath !== undefined) updateData.subpath = requestBody.subpath;

        // Update TEA Component in database
        const updatedComponent = await data.prisma.teaComponent.update({
            where: {
                uuid: componentUuid
            },
            data: updateData
        });

        // Build response
        const response = {
            identifier: updatedComponent.uuid,
            name: updatedComponent.name,
            barcode: updatedComponent.barcode,
            sku: updatedComponent.sku,
            vendor: updatedComponent.vendor,
            identifiers: JSON.parse(updatedComponent.identifiers || `[]`),
            type: updatedComponent.type,
            namespace: updatedComponent.namespace,
            version: updatedComponent.version,
            qualifiers: JSON.parse(updatedComponent.qualifiers || `[]`),
            subpath: updatedComponent.subpath
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error updating TEA Component:`, error);
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

        const componentUuid = params.uuid as string;
        
        // Validate UUID format
        if (!componentUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(componentUuid)) {
            return new Response(JSON.stringify({ error: `Invalid component UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if component exists and belongs to the organization
        const existingComponent = await data.prisma.teaComponent.findUnique({
            where: {
                uuid: componentUuid
            }
        });

        if (!existingComponent) {
            return new Response(JSON.stringify({ error: `Component not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (existingComponent.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Delete related records first (cascade delete)
        await data.prisma.$transaction(async (tx) => {
            // Delete product-component relationships
            await tx.teaProductComponent.deleteMany({
                where: {
                    componentUuid: componentUuid
                }
            });

            // Delete release-component relationships
            await tx.teaReleaseComponent.deleteMany({
                where: {
                    componentUuid: componentUuid
                }
            });

            // Delete the component
            await tx.teaComponent.delete({
                where: {
                    uuid: componentUuid
                }
            });
        });

        return new Response(null, {
            status: 204
        });

    } catch (error) {
        console.error(`Error deleting TEA Component:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

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

        const componentUuid = params.uuid as string;
        
        // Validate UUID format
        if (!componentUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(componentUuid)) {
            return new Response(JSON.stringify({ error: `Invalid component UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get component with releases
        const component = await data.prisma.teaComponent.findUnique({
            where: {
                uuid: componentUuid
            },
            include: {
                releases: {
                    select: {
                        releaseUuid: true
                    }
                }
            }
        });

        if (!component) {
            return new Response(JSON.stringify({ error: `Component not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check organization access
        if (component.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Transform to API format
        const response = {
            uuid: component.uuid,
            name: component.name,
            identifiers: JSON.parse(component.identifiers || '[]'),
            versions: component.version ? [component.version] : [],
            releases: component.releases.map(r => r.releaseUuid)
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error fetching TEA Component:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
