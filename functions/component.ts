import type { CreateTeaComponentRequest } from "./types";
import type { PrismaClient } from "@prisma/client";

export async function onRequestPost<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, request } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        // Parse request body (data.json is already parsed by middleware)
        const requestBody: CreateTeaComponentRequest = await request.json();
        
        // Validate required fields
        if (!requestBody.name) {
            return new Response(JSON.stringify({ error: `Missing required field: name` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!requestBody.type) {
            return new Response(JSON.stringify({ error: `Missing required field: type` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!requestBody.productIdentifier) {
            return new Response(JSON.stringify({ error: `Missing required field: productIdentifier` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Generate UUID for the component
        const componentUuid = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        // Create TEA Component in database
        const teaComponent = await prisma.teaComponent.create({
            data: {
                uuid: componentUuid,
                name: requestBody.name,
                type: requestBody.type,
                namespace: requestBody.namespace || ``,
                version: requestBody.version,
                qualifiers: JSON.stringify(requestBody.qualifiers || []),
                subpath: requestBody.subpath,
                barcode: requestBody.barcode,
                sku: requestBody.sku,
                vendor: requestBody.vendor,
                identifiers: JSON.stringify(requestBody.identifiers || []),
                primaryLanguage: null,
                homepageUrl: null,
                downloadUrl: null,
                description: null,
                releaseDate: null,
                validUntilDate: null,
                createdAt: now,
                updatedAt: now
            }
        });

        // Create the product-component relationship
        await prisma.teaProductComponent.create({
            data: {
                productUuid: requestBody.productIdentifier,
                componentUuid: componentUuid,
                relationship: `component`,
                createdAt: now
            }
        });

        // Build response  
        const response = {
            identifier: teaComponent.uuid,
            name: teaComponent.name,
            barcode: teaComponent.barcode,
            sku: teaComponent.sku,
            vendor: teaComponent.vendor,
            identifiers: JSON.parse(teaComponent.identifiers || `[]`),
            type: teaComponent.type,
            namespace: teaComponent.namespace,
            version: teaComponent.version,
            qualifiers: JSON.parse(teaComponent.qualifiers || `[]`),
            subpath: teaComponent.subpath
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error creating TEA Component:`, error);
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
        const idType = url.searchParams.get('idType');
        const idValue = url.searchParams.get('idValue');

        // Build where clause
        const where: any = {};

        // Handle identifier filtering
        if (idType && idValue) {
            where.identifiers = {
                contains: JSON.stringify({ idType, idValue })
            };
        }

        // Get total count
        const total = await prisma.teaComponent.count({ where });

        // Get components with pagination
        const components = await prisma.teaComponent.findMany({
            where,
            skip: pageOffset,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                releases: {
                    select: {
                        releaseUuid: true
                    }
                }
            }
        });

        // Transform to API format
        const componentData = components.map(component => ({
            uuid: component.uuid,
            name: component.name,
            identifiers: JSON.parse(component.identifiers || '[]'),
            versions: component.version ? [component.version] : [],
            releases: component.releases.map(r => r.releaseUuid)
        }));

        const response = {
            data: componentData,
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
        console.error(`Error fetching TEA Components:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
