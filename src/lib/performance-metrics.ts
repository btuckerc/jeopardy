/**
 * Performance Metrics Collection & Storage
 * 
 * Collects API timing data and stores it in-memory for admin dashboard viewing.
 * Uses a circular buffer to keep memory bounded while retaining recent metrics.
 */

export interface RouteMetric {
    route: string
    method: string
    statusCode: number
    durationMs: number
    timestamp: Date
    steps?: Record<string, number> // Step-by-step breakdown
}

export interface RouteStats {
    route: string
    method: string
    count: number
    avgMs: number
    minMs: number
    maxMs: number
    p50Ms: number
    p95Ms: number
    p99Ms: number
    errorRate: number // percentage of 4xx/5xx
    lastHourCount: number
    recentRequests: RouteMetric[] // Last 10 requests
}

export interface PerformanceSnapshot {
    timestamp: Date
    totalRequests: number
    avgResponseTime: number
    errorRate: number
    slowestRoutes: RouteStats[]
    mostFrequentRoutes: RouteStats[]
    recentSlowRequests: RouteMetric[]
    routeStats: RouteStats[]
}

// Circular buffer for storing metrics
const MAX_METRICS = 10000
const metrics: RouteMetric[] = []
let metricsIndex = 0
let totalMetricsRecorded = 0

// Store the last cold start compilation times
interface CompilationEvent {
    route: string
    durationMs: number
    timestamp: Date
}
const compilationEvents: CompilationEvent[] = []
const MAX_COMPILATION_EVENTS = 100

/**
 * Record a performance metric for an API route
 */
export function recordMetric(metric: Omit<RouteMetric, 'timestamp'>): void {
    const fullMetric: RouteMetric = {
        ...metric,
        timestamp: new Date()
    }
    
    // Use circular buffer
    if (metrics.length < MAX_METRICS) {
        metrics.push(fullMetric)
    } else {
        metrics[metricsIndex] = fullMetric
    }
    metricsIndex = (metricsIndex + 1) % MAX_METRICS
    totalMetricsRecorded++
}

/**
 * Record a compilation event (for cold start tracking)
 */
export function recordCompilation(route: string, durationMs: number): void {
    if (compilationEvents.length >= MAX_COMPILATION_EVENTS) {
        compilationEvents.shift()
    }
    compilationEvents.push({
        route,
        durationMs,
        timestamp: new Date()
    })
}

/**
 * Get compilation events for display
 */
export function getCompilationEvents(): CompilationEvent[] {
    return [...compilationEvents].reverse()
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
}

/**
 * Get statistics for a specific route
 */
function getRouteStats(route: string, method: string, routeMetrics: RouteMetric[]): RouteStats {
    const filtered = routeMetrics.filter(m => m.route === route && m.method === method)
    if (filtered.length === 0) {
        return {
            route,
            method,
            count: 0,
            avgMs: 0,
            minMs: 0,
            maxMs: 0,
            p50Ms: 0,
            p95Ms: 0,
            p99Ms: 0,
            errorRate: 0,
            lastHourCount: 0,
            recentRequests: []
        }
    }
    
    const durations = filtered.map(m => m.durationMs).sort((a, b) => a - b)
    const errors = filtered.filter(m => m.statusCode >= 400).length
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const lastHourMetrics = filtered.filter(m => m.timestamp.getTime() > oneHourAgo)
    
    return {
        route,
        method,
        count: filtered.length,
        avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minMs: durations[0],
        maxMs: durations[durations.length - 1],
        p50Ms: percentile(durations, 50),
        p95Ms: percentile(durations, 95),
        p99Ms: percentile(durations, 99),
        errorRate: Math.round((errors / filtered.length) * 100),
        lastHourCount: lastHourMetrics.length,
        recentRequests: filtered.slice(-10).reverse()
    }
}

/**
 * Get a full performance snapshot for the admin dashboard
 */
export function getPerformanceSnapshot(): PerformanceSnapshot {
    const allMetrics = [...metrics].filter(Boolean) // Filter out empty slots
    
    if (allMetrics.length === 0) {
        return {
            timestamp: new Date(),
            totalRequests: 0,
            avgResponseTime: 0,
            errorRate: 0,
            slowestRoutes: [],
            mostFrequentRoutes: [],
            recentSlowRequests: [],
            routeStats: []
        }
    }
    
    // Group by route+method
    const routeGroups = new Map<string, RouteMetric[]>()
    for (const metric of allMetrics) {
        const key = `${metric.method}:${metric.route}`
        if (!routeGroups.has(key)) {
            routeGroups.set(key, [])
        }
        routeGroups.get(key)!.push(metric)
    }
    
    // Calculate stats for each route
    const routeStats: RouteStats[] = []
    for (const [key, routeMetrics] of routeGroups) {
        const [method, route] = key.split(':')
        routeStats.push(getRouteStats(route, method, routeMetrics))
    }
    
    // Overall stats
    const allDurations = allMetrics.map(m => m.durationMs)
    const totalErrors = allMetrics.filter(m => m.statusCode >= 400).length
    
    // Slowest routes by p95
    const slowestRoutes = [...routeStats]
        .sort((a, b) => b.p95Ms - a.p95Ms)
        .slice(0, 10)
    
    // Most frequent routes
    const mostFrequentRoutes = [...routeStats]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    
    // Recent slow requests (> 500ms)
    const recentSlowRequests = allMetrics
        .filter(m => m.durationMs > 500)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20)
    
    return {
        timestamp: new Date(),
        totalRequests: totalMetricsRecorded,
        avgResponseTime: Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length),
        errorRate: Math.round((totalErrors / allMetrics.length) * 100),
        slowestRoutes,
        mostFrequentRoutes,
        recentSlowRequests,
        routeStats: routeStats.sort((a, b) => b.lastHourCount - a.lastHourCount)
    }
}

/**
 * Clear all metrics (useful for testing)
 */
export function clearMetrics(): void {
    metrics.length = 0
    metricsIndex = 0
    totalMetricsRecorded = 0
    compilationEvents.length = 0
}

