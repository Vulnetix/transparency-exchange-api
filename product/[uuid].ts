import { Context, UpdateTeaProductRequest } from "@shared/interfaces";

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

        const productUuid = params.uuid as string;
        
        // Validate UUID format
        if (!productUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productUuid)) {
            return new Response(JSON.stringify({ error: `Invalid product UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get product with components
        const product = await data.prisma.teaProduct.findUnique({
            where: {
                uuid: productUuid
            },
            include: {
                components: {
                    select: {
                        componentUuid: true
                    }
                }
            }
        });

        if (!product) {
            return new Response(JSON.stringify({ error: `Product not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check organization access
        if (product.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Transform to API format
        const response = {
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
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error fetching TEA Product:`, error);
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

        const productUuid = params.uuid as string;
        
        // Validate UUID format
        if (!productUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productUuid)) {
            return new Response(JSON.stringify({ error: `Invalid product UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if product exists and belongs to the organization
        const existingProduct = await data.prisma.teaProduct.findUnique({
            where: {
                uuid: productUuid
            }
        });

        if (!existingProduct) {
            return new Response(JSON.stringify({ error: `Product not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (existingProduct.orgId !== data.session.orgId) {
            return new Response(JSON.stringify({ error: `Access denied` }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parse request body
        const requestBody: UpdateTeaProductRequest = data.json;
        
        // Build update data
        const updateData: any = {
            updatedAt: Math.floor(Date.now() / 1000)
        };

        if (requestBody.name !== undefined) updateData.name = requestBody.name;
        if (requestBody.type !== undefined) updateData.type = requestBody.type;
        if (requestBody.namespace !== undefined) updateData.namespace = requestBody.namespace;
        if (requestBody.version !== undefined) updateData.version = requestBody.version;
        if (requestBody.barcode !== undefined) updateData.barcode = requestBody.barcode;
        if (requestBody.sku !== undefined) updateData.sku = requestBody.sku;
        if (requestBody.vendorUuid !== undefined) updateData.vendor = requestBody.vendorUuid;
        if (requestBody.identifiers !== undefined) updateData.identifiers = JSON.stringify(requestBody.identifiers);
        if (requestBody.qualifiers !== undefined) updateData.qualifiers = JSON.stringify(requestBody.qualifiers);
        if (requestBody.subpath !== undefined) updateData.subpath = requestBody.subpath;

        // Update TEA Product in database
        const updatedProduct = await data.prisma.teaProduct.update({
            where: {
                uuid: productUuid
            },
            data: updateData
        });

        // Get components for this product
        const productComponents = await data.prisma.teaProductComponent.findMany({
            where: {
                productUuid: updatedProduct.uuid
            },
            select: {
                componentUuid: true
            }
        });

        // Build response matching OpenAPI specification
        const response = {
            identifier: updatedProduct.uuid, // OpenAPI expects 'identifier' not 'uuid'
            name: updatedProduct.name,
            barcode: updatedProduct.barcode,
            sku: updatedProduct.sku,
            vendorUuid: updatedProduct.vendor, // Return as vendorUuid to match OpenAPI
            identifiers: updatedProduct.identifiers ? JSON.parse(updatedProduct.identifiers) : [],
            type: updatedProduct.type,
            namespace: updatedProduct.namespace,
            version: updatedProduct.version,
            qualifiers: updatedProduct.qualifiers ? JSON.parse(updatedProduct.qualifiers) : [],
            subpath: updatedProduct.subpath,
            components: productComponents.map(pc => pc.componentUuid) // Required by OpenAPI
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error updating TEA Product:`, error);
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

        const productUuid = params.uuid as string;
        
        // Validate UUID format
        if (!productUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productUuid)) {
            return new Response(JSON.stringify({ error: `Invalid product UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if product exists and belongs to the organization
        const existingProduct = await data.prisma.teaProduct.findUnique({
            where: {
                uuid: productUuid
            }
        });

        if (!existingProduct) {
            return new Response(JSON.stringify({ error: `Product not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (existingProduct.orgId !== data.session.orgId) {
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
                    productUuid: productUuid
                }
            });

            // Delete releases and their component relationships
            const releases = await tx.teaRelease.findMany({
                where: {
                    productUuid: productUuid
                }
            });

            for (const release of releases) {
                await tx.teaReleaseComponent.deleteMany({
                    where: {
                        releaseUuid: release.uuid
                    }
                });
            }

            await tx.teaRelease.deleteMany({
                where: {
                    productUuid: productUuid
                }
            });

            // Delete the product
            await tx.teaProduct.delete({
                where: {
                    uuid: productUuid
                }
            });
        });

        return new Response(null, {
            status: 204
        });

    } catch (error) {
        console.error(`Error deleting TEA Product:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
