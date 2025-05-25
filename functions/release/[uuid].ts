import type { UpdateTeaReleaseRequest } from "../types";
import type { PrismaClient } from "@prisma/client";

export async function onRequestPatch<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, params, request } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        const releaseUuid = params.uuid as string;
        
        // Validate UUID format
        if (!releaseUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(releaseUuid)) {
            return new Response(JSON.stringify({ error: `Invalid release UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if release exists and belongs to the organization
        const existingRelease = await prisma.teaRelease.findUnique({
            where: {
                uuid: releaseUuid
            }
        });

        if (!existingRelease) {
            return new Response(JSON.stringify({ error: `Release not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // Parse request body
        const requestBody: UpdateTeaReleaseRequest = await request.json();
        
        // Build update data
        const updateData: any = {
            updatedAt: Math.floor(Date.now() / 1000)
        };

        if (requestBody.tag !== undefined) updateData.tag = requestBody.tag;
        if (requestBody.version !== undefined) updateData.version = requestBody.version;
        if (requestBody.name !== undefined) updateData.name = requestBody.name;
        if (requestBody.description !== undefined) updateData.description = requestBody.description;
        if (requestBody.releaseDate !== undefined) updateData.releaseDate = requestBody.releaseDate;
        if (requestBody.validUntilDate !== undefined) updateData.validUntilDate = requestBody.validUntilDate;
        if (requestBody.prerelease !== undefined) updateData.prerelease = requestBody.prerelease;
        if (requestBody.draft !== undefined) updateData.draft = requestBody.draft;

        // Update TEA Release in database
        const updatedRelease = await prisma.teaRelease.update({
            where: {
                uuid: releaseUuid
            },
            data: updateData
        });

        // Get the components associated with this release
        const releaseComponents = await prisma.teaReleaseComponent.findMany({
            where: {
                releaseUuid: releaseUuid
            }
        });

        // Build response
        const response = {
            identifier: updatedRelease.uuid,
            productUuid: updatedRelease.productUuid,
            tag: updatedRelease.tag,
            version: updatedRelease.version,
            name: updatedRelease.name,
            description: updatedRelease.description,
            releaseDate: updatedRelease.releaseDate,
            validUntilDate: updatedRelease.validUntilDate,
            prerelease: updatedRelease.prerelease,
            draft: updatedRelease.draft,
            components: releaseComponents.map(rc => rc.componentUuid)
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error updating TEA Release:`, error);
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

        const releaseUuid = params.uuid as string;
        
        // Validate UUID format
        if (!releaseUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(releaseUuid)) {
            return new Response(JSON.stringify({ error: `Invalid release UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if release exists and belongs to the organization
        const existingRelease = await prisma.teaRelease.findUnique({
            where: {
                uuid: releaseUuid
            }
        });

        if (!existingRelease) {
            return new Response(JSON.stringify({ error: `Release not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // Delete related records first (cascade delete)
        await prisma.$transaction(async (tx) => {
            // Delete release-component relationships
            await tx.teaReleaseComponent.deleteMany({
                where: {
                    releaseUuid: releaseUuid
                }
            });

            // Delete the release
            await tx.teaRelease.delete({
                where: {
                    uuid: releaseUuid
                }
            });
        });

        return new Response(null, {
            status: 204
        });

    } catch (error) {
        console.error(`Error deleting TEA Release:`, error);
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

        const releaseUuid = params.uuid as string;
        
        // Validate UUID format
        if (!releaseUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(releaseUuid)) {
            return new Response(JSON.stringify({ error: `Invalid release UUID` }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get release with related data
        const release = await prisma.teaRelease.findUnique({
            where: {
                uuid: releaseUuid
            },
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

        if (!release) {
            return new Response(JSON.stringify({ error: `Release not found` }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // Collect all identifiers from associated components
        const allIdentifiers: any[] = [];
        release.components.forEach(rc => {
            const componentIdentifiers = JSON.parse(rc.component.identifiers || '[]');
            allIdentifiers.push(...componentIdentifiers);
        });

        // Transform to API format
        const response = {
            uuid: release.uuid,
            version: release.version || '',
            releaseDate: release.releaseDate || new Date().toISOString(),
            preRelease: release.prerelease || false,
            identifiers: allIdentifiers,
            collectionReferences: release.product.collections.map(c => c.uuid)
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`Error fetching TEA Release:`, error);
        return new Response(JSON.stringify({ error: `Internal server error` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
