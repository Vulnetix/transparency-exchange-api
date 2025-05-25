import type { UpdateTeaComponentRequest } from "../types";
import type { PrismaClient } from "@prisma/client";

export async function onRequestPatch<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, params, request } = context;
    const prisma = data.prisma as PrismaClient;

    try {
        const componentUuid = params.uuid as string;
        
        // Validate UUID format
        if (!componentUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(componentUuid)) {
            return new Response(JSON.stringify({ error: `Invalid component UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if component exists and belongs to the organization
        const existingComponent = await prisma.teaComponent.findUnique({
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

        // Parse request body
        const requestBody: UpdateTeaComponentRequest = await request.json();
        
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
        const updatedComponent = await prisma.teaComponent.update({
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

export async function onRequestDelete<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, params } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        const componentUuid = params.uuid as string;
        
        // Validate UUID format
        if (!componentUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(componentUuid)) {
            return new Response(JSON.stringify({ error: `Invalid component UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if component exists and belongs to the organization
        const existingComponent = await prisma.teaComponent.findUnique({
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

        // Delete related records first (cascade delete)
        await prisma.$transaction(async (tx) => {
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

export async function onRequestGet<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, params } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        const componentUuid = params.uuid as string;
        
        // Validate UUID format
        if (!componentUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(componentUuid)) {
            return new Response(JSON.stringify({ error: `Invalid component UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get component with releases
        const component = await prisma.teaComponent.findUnique({
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
