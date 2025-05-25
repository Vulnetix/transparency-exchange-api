import type { CreateTeaProductRequest } from "./types";
import type { PrismaClient } from "@prisma/client";

export async function onRequestPost<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, request } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        // Parse request body (data.json is already parsed by middleware)
        const requestBody: CreateTeaProductRequest = await request.json();
        
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

        // Generate UUID for the product
        const productUuid = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        // Create TEA Product in database
        const teaProduct = await prisma.teaProduct.create({
            data: {
                uuid: productUuid,
                name: requestBody.name,
                type: requestBody.type || `generic`,
                barcode: requestBody.barcode,
                sku: requestBody.sku,
                vendor: requestBody.vendorUuid, // Store vendorUuid from request
                namespace: requestBody.namespace || ``,
                version: requestBody.version,
                qualifiers: JSON.stringify(requestBody.qualifiers || []),
                identifiers: JSON.stringify(requestBody.identifiers || []),
                subpath: requestBody.subpath,
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

        // Get components for this product (initially empty for new product)
        const productComponents = await prisma.teaProductComponent.findMany({
            where: {
                productUuid: teaProduct.uuid
            },
            select: {
                componentUuid: true
            }
        });

        // Build response matching OpenAPI specification
        const response = {
            identifier: teaProduct.uuid, // OpenAPI expects 'identifier' not 'uuid'
            name: teaProduct.name,
            barcode: teaProduct.barcode,
            sku: teaProduct.sku,
            vendorUuid: teaProduct.vendor, // Return as vendorUuid to match OpenAPI
            identifiers: teaProduct.identifiers ? JSON.parse(teaProduct.identifiers) : [],
            type: teaProduct.type,
            namespace: teaProduct.namespace,
            version: teaProduct.version,
            qualifiers: teaProduct.qualifiers ? JSON.parse(teaProduct.qualifiers) : [],
            subpath: teaProduct.subpath,
            components: productComponents.map(pc => pc.componentUuid) // Required by OpenAPI
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error creating TEA Product:`, error);
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
        const barcode = url.searchParams.get('barcode');
        const sku = url.searchParams.get('sku');
        const vendorUuid = url.searchParams.get('vendorUuid');
        const idType = url.searchParams.get('idType');
        const idValue = url.searchParams.get('idValue');

        // Build where clause
        const where: any = {};

        if (barcode) where.barcode = barcode;
        if (sku) where.sku = sku;
        if (vendorUuid) where.vendor = vendorUuid;

        // Handle identifier filtering
        if (idType && idValue) {
            where.identifiers = {
                contains: JSON.stringify({ idType, idValue })
            };
        }

        // Get total count
        const total = await prisma.teaProduct.count({ where });

        // Get products with pagination
        const products = await prisma.teaProduct.findMany({
            where,
            skip: pageOffset,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                components: {
                    select: {
                        componentUuid: true
                    }
                }
            }
        });

        // Transform to API format
        const productData = products.map(product => ({
            identifier: product.uuid,
            name: product.name,
            barcode: product.barcode,
            sku: product.sku,
            vendorUuid: product.vendor,
            identifiers: JSON.parse(product.identifiers || '[]'),
            type: product.type,
            namespace: product.namespace,
            version: product.version,
            qualifiers: JSON.parse(product.qualifiers || '[]'),
            subpath: product.subpath,
            components: product.components.map(c => c.componentUuid)
        }));

        const response = {
            data: productData,
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
        console.error(`Error fetching TEA Products:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
