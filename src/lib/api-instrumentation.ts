/**
 * API Instrumentation
 * 
 * Provides request tracking and metrics for API routes.
 * Persists events to the database for admin observability dashboard.
 * 
 * Sampling strategy (to minimize overhead):
 * - 100% of errors (4xx/5xx)
 * - 100% of slow requests (>200ms)
 * - 10% of normal fast requests (configurable)
 * 
 * Writes are fire-and-forget to avoid blocking requests.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, setRequestContextGetter } from './prisma'

// Request context for correlating DB queries with API requests
interface RequestContext {
    requestId: string
    startTime: number
    route: string
    method: string
}

// AsyncLocalStorage to track request context across async operations
import { AsyncLocalStorage } from 'async_hooks'
export const requestContext = new AsyncLocalStorage<RequestContext>()

// Connect request context to Prisma for query correlation
setRequestContextGetter(() => {
    const ctx = requestContext.getStore()
    return ctx ? { requestId: ctx.requestId } : undefined
})

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 10)
    return `${timestamp}-${random}`
}

/**
 * Get the current request context (if available)
 */
export function getCurrentRequestContext(): RequestContext | undefined {
    return requestContext.getStore()
}

/**
 * Configuration for API instrumentation
 */
export interface InstrumentationConfig {
    /** Sample rate for fast successful requests (0-1). Default: 0.1 (10%) */
    fastRequestSampleRate?: number
    /** Threshold in ms above which requests are always logged. Default: 200ms */
    slowThresholdMs?: number
    /** Always log errors (4xx/5xx). Default: true */
    alwaysLogErrors?: boolean
    /** Routes to exclude from logging (exact match or prefix) */
    excludeRoutes?: string[]
    /** Whether this is an admin route. Default: auto-detect */
    isAdminRoute?: boolean
}

const DEFAULT_CONFIG: Required<InstrumentationConfig> = {
    fastRequestSampleRate: 0.1, // 10% of fast requests
    slowThresholdMs: 200, // Always log requests slower than 200ms
    alwaysLogErrors: true,
    excludeRoutes: [
        '/api/health',
        '/api/admin/api-metrics', // Avoid recursion
        '/api/admin/db-metrics',  // Avoid recursion
        '/api/admin/perf-metrics', // Avoid recursion
    ],
    isAdminRoute: false,
}

/**
 * Determine if a request should be logged based on smart sampling:
 * - Always log errors (4xx/5xx)
 * - Always log slow requests (above threshold)
 * - Sample fast successful requests
 */
function shouldLog(
    statusCode: number, 
    durationMs: number, 
    config: Required<InstrumentationConfig>
): boolean {
    // Always log errors
    if (config.alwaysLogErrors && statusCode >= 400) {
        return true
    }
    
    // Always log slow requests
    if (durationMs >= config.slowThresholdMs) {
        return true
    }
    
    // Sample fast successful requests
    return Math.random() < config.fastRequestSampleRate
}

/**
 * Extract route from request URL
 */
function extractRoute(url: string): string {
    try {
        const urlObj = new URL(url)
        // Remove query params and normalize
        return urlObj.pathname
    } catch {
        return url
    }
}

/**
 * Log an API request event to the database (non-blocking)
 */
async function logApiRequestEvent(event: {
    requestId: string
    route: string
    method: string
    statusCode: number
    durationMs: number
    userId?: string
    isAdminRoute: boolean
    errorCode?: string
    errorMessage?: string
    userAgent?: string
    ip?: string
}): Promise<void> {
    try {
        await prisma.apiRequestEvent.create({
            data: {
                requestId: event.requestId,
                route: event.route,
                method: event.method,
                statusCode: event.statusCode,
                durationMs: event.durationMs,
                userId: event.userId,
                isAdminRoute: event.isAdminRoute,
                errorCode: event.errorCode,
                errorMessage: event.errorMessage ? event.errorMessage.slice(0, 1000) : null, // Truncate long messages
                userAgent: event.userAgent ? event.userAgent.slice(0, 500) : null,
                ip: event.ip,
            }
        })
    } catch (error) {
        // Don't let instrumentation errors affect the request
        console.error('[API Instrumentation] Failed to log request event:', error)
    }
}

/**
 * Type for Next.js API route handlers
 */
type RouteHandler = (
    request: NextRequest,
    context?: { params?: Record<string, string | string[]> }
) => Promise<NextResponse> | NextResponse

/**
 * Wrap an API route handler with instrumentation
 * 
 * @example
 * ```ts
 * export const GET = withInstrumentation(async (request) => {
 *     // Your handler logic
 *     return jsonResponse({ data: 'hello' })
 * })
 * ```
 */
export function withInstrumentation(
    handler: RouteHandler,
    config: InstrumentationConfig = {}
): RouteHandler {
    const mergedConfig: Required<InstrumentationConfig> = {
        ...DEFAULT_CONFIG,
        ...config,
    }

    return async (request: NextRequest, context?: { params?: Record<string, string | string[]> }) => {
        const requestId = generateRequestId()
        const startTime = performance.now()
        const route = extractRoute(request.url)
        const method = request.method

        // Check if this route should be excluded
        const isExcluded = mergedConfig.excludeRoutes.some(
            excluded => route === excluded || route.startsWith(excluded + '/')
        )

        // Auto-detect admin routes
        const isAdminRoute = mergedConfig.isAdminRoute || route.startsWith('/api/admin')

        // Create request context for correlation
        const reqContext: RequestContext = {
            requestId,
            startTime,
            route,
            method,
        }

        try {
            // Run handler within request context
            const response = await requestContext.run(reqContext, async () => {
                return await handler(request, context)
            })

            const durationMs = Math.round(performance.now() - startTime)
            const statusCode = response.status

            // Log to database if not excluded and passes smart sampling
            // (100% of errors, 100% of slow, 10% of fast)
            if (!isExcluded && shouldLog(statusCode, durationMs, mergedConfig)) {
                // Get user ID from response headers if available
                const userId = response.headers.get('x-user-id') || undefined

                // Fire and forget - don't await to avoid blocking the response
                logApiRequestEvent({
                    requestId,
                    route,
                    method,
                    statusCode,
                    durationMs,
                    userId,
                    isAdminRoute,
                    userAgent: request.headers.get('user-agent') || undefined,
                    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                        request.headers.get('x-real-ip') || 
                        undefined,
                }).catch(() => {}) // Swallow errors to never impact request
            }

            return response
        } catch (error) {
            const durationMs = Math.round(performance.now() - startTime)

            // Always log errors to database (unless excluded route)
            if (!isExcluded) {
                logApiRequestEvent({
                    requestId,
                    route,
                    method,
                    statusCode: 500,
                    durationMs,
                    isAdminRoute,
                    errorCode: 'UNHANDLED_ERROR',
                    errorMessage: error instanceof Error ? error.message : String(error),
                    userAgent: request.headers.get('user-agent') || undefined,
                    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                        request.headers.get('x-real-ip') || 
                        undefined,
                }).catch(() => {})
            }

            // Re-throw to let the framework handle it
            throw error
        }
    }
}

/**
 * Simple request logging (for use without the wrapper)
 * Call this manually in routes that can't use the wrapper pattern
 */
export async function logRequest(
    request: NextRequest,
    response: NextResponse,
    options?: {
        userId?: string
        errorCode?: string
        errorMessage?: string
        startTime?: number
    }
): Promise<void> {
    const route = extractRoute(request.url)
    const isExcluded = DEFAULT_CONFIG.excludeRoutes.some(
        excluded => route === excluded || route.startsWith(excluded + '/')
    )
    
    if (isExcluded) return

    const durationMs = options?.startTime 
        ? Math.round(performance.now() - options.startTime)
        : 0

    if (!shouldLog(response.status, DEFAULT_CONFIG)) return

    await logApiRequestEvent({
        requestId: generateRequestId(),
        route,
        method: request.method,
        statusCode: response.status,
        durationMs,
        userId: options?.userId,
        isAdminRoute: route.startsWith('/api/admin'),
        errorCode: options?.errorCode,
        errorMessage: options?.errorMessage,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
            request.headers.get('x-real-ip') || 
            undefined,
    })
}

// =============================================================================
// Backward compatibility with old api-error-logger interface
// =============================================================================

/**
 * @deprecated Use withInstrumentation wrapper instead
 * Kept for backward compatibility - now persists to database
 */
export async function logApiError(
    route: string,
    method: string,
    statusCode: number,
    errorCode?: string,
    message?: string
): Promise<void> {
    if (statusCode < 400) return

    try {
        await prisma.apiRequestEvent.create({
            data: {
                requestId: generateRequestId(),
                route,
                method,
                statusCode,
                durationMs: 0, // Unknown duration when called directly
                isAdminRoute: route.startsWith('/api/admin'),
                errorCode,
                errorMessage: message ? message.slice(0, 1000) : null,
            }
        })
    } catch (error) {
        console.error('[API Instrumentation] Failed to log error:', error)
    }
}

/**
 * Get error counts by status code within a time window
 * Now queries from database instead of in-memory
 */
export async function getErrorCountsByStatus(
    startTime: Date,
    endTime: Date = new Date()
): Promise<Map<number, number>> {
    try {
        const results = await prisma.apiRequestEvent.groupBy({
            by: ['statusCode'],
            where: {
                timestamp: {
                    gte: startTime,
                    lte: endTime,
                },
                statusCode: {
                    gte: 400,
                },
            },
            _count: {
                id: true,
            },
        })

        const counts = new Map<number, number>()
        results.forEach(r => {
            counts.set(r.statusCode, r._count.id)
        })
        return counts
    } catch (error) {
        console.error('[API Instrumentation] Failed to get error counts:', error)
        return new Map()
    }
}

/**
 * Get error counts grouped by time bucket
 * Now queries from database instead of in-memory
 */
export async function getErrorCountsByBucket(
    startTime: Date,
    endTime: Date = new Date(),
    bucketMs: number = 60 * 60 * 1000
): Promise<Map<string, Map<number, number>>> {
    try {
        const events = await prisma.apiRequestEvent.findMany({
            where: {
                timestamp: {
                    gte: startTime,
                    lte: endTime,
                },
                statusCode: {
                    gte: 400,
                },
            },
            select: {
                timestamp: true,
                statusCode: true,
            },
        })

        const buckets = new Map<string, Map<number, number>>()

        events.forEach(event => {
            const bucketTime = new Date(
                Math.floor(event.timestamp.getTime() / bucketMs) * bucketMs
            )
            const bucketKey = bucketMs === 60 * 60 * 1000
                ? bucketTime.toISOString().slice(0, 13) + ':00:00'
                : bucketTime.toISOString().slice(0, 10)

            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, new Map<number, number>())
            }

            const bucket = buckets.get(bucketKey)!
            bucket.set(event.statusCode, (bucket.get(event.statusCode) || 0) + 1)
        })

        return buckets
    } catch (error) {
        console.error('[API Instrumentation] Failed to get error counts by bucket:', error)
        return new Map()
    }
}

