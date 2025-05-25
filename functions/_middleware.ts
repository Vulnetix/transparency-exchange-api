import { PrismaD1 } from '@prisma/adapter-d1';
import { Prisma, PrismaClient } from '@prisma/client';

// Connection to D1 using Prisma ORM and ensure JSON body is available as an object
export async function setupDependencies<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { env, data, next } = context
    const adapter: PrismaD1 = new PrismaD1(env.d1db)
    const clientOptions: Prisma.PrismaClientOptions = {
        adapter,
        transactionOptions: {
            maxWait: 1500, // default: 2000
            timeout: 2000, // default: 5000
        },
        log: [{ emit: 'event', level: 'query' }]
    }
    data.prisma = new PrismaClient(clientOptions)
    // @ts-ignore
    data.prisma.$on("query", async (e: Prisma.QueryEvent) => {
        // @ts-ignore
        data.logger.debug(`${e.query} ${e.params}`)
    })

    return next()
}

// Ensure authentication is always performed, with specified exceptions
export async function authentication<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { env, request, next } = context
    const url = new URL(request.url)
    const publicPaths = [
        '/health',
        '/status',
        '/favicon.ico',
        '/robots.txt',
        '/.well-known/ai-plugin.json',
        '/.well-known/ai-plugin.json',
        '/.well-known/openapi.yaml',
        '/.well-known/openapi.json'
    ]

    if (publicPaths.some(path => url.pathname.startsWith(path))) {
        return next()
    }

    // Perform authentication logic here
    // If authenticated, proceed to the next middleware or handler
    // If not authenticated, return a 401 Unauthorized response

    return next()
}

export async function redirect<PagesFunction>(context: EventContext<Env, string, Record<string, unknown>>): Promise<Response | void> {
    const { request, next } = context
    const redirects: Record<string, string> = {
        // '/': 'https://example.com',
    }
    const url = new URL(request.url)
    if (redirects[url.pathname]) {
        return new Response(null, {
            status: 307,
            headers: {
                'Location': redirects[url.pathname],
            },
        })
    }
    return next()
}
export const onRequest = [
    redirect, // 307 Redirect using Location header
    setupDependencies, // Setup Prisma ORM and ensure JSON body is available
    authentication, // Authenticate requests
]
