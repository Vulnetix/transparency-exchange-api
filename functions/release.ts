import type { CreateTeaReleaseRequest } from "./types";
import type { PrismaClient } from "@prisma/client";

export async function onRequestPost<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { data, request } = context;
    const prisma = data.prisma as PrismaClient;
    
    try {

        // Parse request body (data.json is already parsed by middleware)
        const requestBody: CreateTeaReleaseRequest = await request.json();
        
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
        const existingComponent = await prisma.teaComponent.findUnique({
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
        // Find the product that owns this component
        const productComponent = await prisma.teaProductComponent.findFirst({
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
        const teaRelease = await prisma.teaRelease.create({
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
                createdAt: now,
                updatedAt: now
            }
        });

        // Create the release-component relationship
        await prisma.teaReleaseComponent.create({
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

        // For releases, we need to check component identifiers if filtering by idType/idValue
        if (idType && idValue) {
            // Find components with matching identifiers
            const matchingComponents = await prisma.teaComponent.findMany({
                where: {
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
        const total = await prisma.teaRelease.count({ where });

        // Get releases with pagination
        const releases = await prisma.teaRelease.findMany({
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
