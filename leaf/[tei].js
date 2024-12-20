import { Visibility } from "@/../shared/tea";

/**
 * If only the serialNumber parameter is supplied, retrieve the latest version of the BOM from the repository.
 * If providing serialNumber and version, a specific version of the BOM will be retrieved.
 * Supports HTTP content negotiation for all CycloneDX BOM formats and versions.
 * If original is true, returns the original, unmodified BOM.
 * 
 * curl -X GET 'http://localhost:8000/v1/bom?serialNumber=urn%3Auuid%3A3e671687-395b-41f5-a30f-a58921a69b79' -H 'accept: application/vnd.cyclonedx+json; version=1.4'
 */
export async function onRequestGet(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context
    try {
        params.tei // TEI unique leaf index
        const visibility = data.searchParams.get('visibility') // Used to specify whether we list public or private components
        if (visibility && ![Visibility.ALLAVAILABLE, Visibility.PUBLICONLY].includes(visibility)) {
            return Response(null, { status: 422, statusText: `Invalid value provided: visibility=${visibility}` })
        }

        // const member = await data.prisma.Member.findFirst({
        //     where: {
        //         email: data.session.memberEmail,
        //     },
        // })
        // return Response.json([]) // [ CollectionEl ]
    } catch (err) {
        console.error(err)
        // return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
