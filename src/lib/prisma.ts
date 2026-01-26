import { PrismaClient } from '@prisma/client'

// =============================================================================
// Configuration
// =============================================================================

/** Threshold in ms to flag a query as "slow" */
const SLOW_QUERY_THRESHOLD_MS = 100

/** Sample rate for normal queries (0-1). Slow queries are always logged. */
const QUERY_SAMPLE_RATE = 0.05 // 5% of normal queries

/** Models to exclude from query logging (to avoid recursion with o11y tables) */
const EXCLUDED_MODELS = ['ApiRequestEvent', 'DbQueryEvent']

/** Actions to exclude from query logging */
const EXCLUDED_ACTIONS = ['$connect', '$disconnect', '$transaction']

// =============================================================================
// Prisma Client Setup with Instrumentation
// =============================================================================

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
    requestContextGetter?: () => { requestId: string } | undefined
}

// Track if middleware is already added (prevents duplicate registration)
let middlewareAdded = false

/**
 * Set the request context getter for correlating queries with API requests
 * Called from api-instrumentation.ts
 */
export function setRequestContextGetter(getter: () => { requestId: string } | undefined): void {
    globalForPrisma.requestContextGetter = getter
}

/**
 * Create or get the Prisma client with instrumentation
 */
function createPrismaClient(): PrismaClient {
    const client = new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
            ? ['error', 'warn'] 
            : ['error'],
    })

    // Add query timing middleware (only once)
    if (!middlewareAdded) {
        addQueryMiddleware(client)
        middlewareAdded = true
    }

    return client
}

/**
 * Add query timing middleware to Prisma client
 */
function addQueryMiddleware(client: PrismaClient): void {
    client.$use(async (params, next) => {
        const startTime = performance.now()
        const model = params.model || 'unknown'
        const action = params.action

        // Skip excluded models (prevents recursion when writing o11y events)
        if (EXCLUDED_MODELS.includes(model)) {
            return next(params)
        }

        // Skip excluded actions
        if (EXCLUDED_ACTIONS.includes(action)) {
            return next(params)
        }

        let success = true
        let error: string | undefined
        let recordCount: number | undefined

        try {
            const result = await next(params)

            // Try to get record count from result
            if (Array.isArray(result)) {
                recordCount = result.length
            } else if (result && typeof result === 'object' && 'count' in result) {
                recordCount = (result as { count: number }).count
            }

            return result
        } catch (e) {
            success = false
            error = e instanceof Error ? e.message : String(e)
            throw e
        } finally {
            const durationMs = Math.round(performance.now() - startTime)
            const isSlow = durationMs >= SLOW_QUERY_THRESHOLD_MS

            // Determine if we should log this query
            const shouldLog = isSlow || Math.random() < QUERY_SAMPLE_RATE || !success

            if (shouldLog) {
                // Get request context if available (for correlation)
                const requestContext = globalForPrisma.requestContextGetter?.()

                // Fire and forget - don't await to avoid blocking queries
                logDbQueryEvent({
                    requestId: requestContext?.requestId,
                    model,
                    action,
                    durationMs,
                    success,
                    error,
                    recordCount,
                    isSlow,
                }).catch(() => {}) // Swallow errors
            }
        }
    })
}

/**
 * Log a DB query event to the database
 * Uses a separate connection to avoid interference with the main query
 */
async function logDbQueryEvent(event: {
    requestId?: string
    model: string
    action: string
    durationMs: number
    success: boolean
    error?: string
    recordCount?: number
    isSlow: boolean
}): Promise<void> {
    try {
        // Use raw SQL to avoid triggering middleware (prevents recursion)
        await prisma.$executeRaw`
            INSERT INTO "DbQueryEvent" (
                "id", "requestId", "timestamp", "model", "action", 
                "durationMs", "success", "error", "recordCount", "isSlow"
            ) VALUES (
                gen_random_uuid(),
                ${event.requestId},
                NOW(),
                ${event.model},
                ${event.action},
                ${event.durationMs},
                ${event.success},
                ${event.error ? event.error.slice(0, 1000) : null},
                ${event.recordCount},
                ${event.isSlow}
            )
        `
    } catch (e) {
        // Don't let instrumentation errors affect the application
        console.error('[Prisma Instrumentation] Failed to log query event:', e)
    }
}

// =============================================================================
// Export
// =============================================================================

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

export default prisma
