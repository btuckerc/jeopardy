/**
 * API Error Logger
 * 
 * Lightweight error logging for API routes to track operational metrics
 * Currently uses in-memory storage, can be extended to use database later
 */

interface ApiErrorLog {
    timestamp: Date
    route: string
    method: string
    statusCode: number
    errorCode?: string
    message?: string
}

// In-memory storage (will be reset on server restart)
// In production, this should be moved to a database table
const errorLogs: ApiErrorLog[] = []
const MAX_LOGS = 10000 // Keep last 10k errors

/**
 * Log an API error
 */
export function logApiError(
    route: string,
    method: string,
    statusCode: number,
    errorCode?: string,
    message?: string
): void {
    // Only log 4xx and 5xx errors
    if (statusCode < 400) return

    const log: ApiErrorLog = {
        timestamp: new Date(),
        route,
        method,
        statusCode,
        errorCode,
        message
    }

    errorLogs.push(log)

    // Keep only the most recent logs
    if (errorLogs.length > MAX_LOGS) {
        errorLogs.shift()
    }
}

/**
 * Get error logs within a time window
 */
export function getErrorLogs(startTime: Date, endTime: Date = new Date()): ApiErrorLog[] {
    return errorLogs.filter(log => 
        log.timestamp >= startTime && log.timestamp <= endTime
    )
}

/**
 * Get error counts by status code within a time window
 */
export function getErrorCountsByStatus(
    startTime: Date,
    endTime: Date = new Date()
): Map<number, number> {
    const logs = getErrorLogs(startTime, endTime)
    const counts = new Map<number, number>()

    logs.forEach(log => {
        counts.set(log.statusCode, (counts.get(log.statusCode) || 0) + 1)
    })

    return counts
}

/**
 * Get error counts grouped by time bucket
 */
export function getErrorCountsByBucket(
    startTime: Date,
    endTime: Date = new Date(),
    bucketMs: number = 60 * 60 * 1000 // Default 1 hour
): Map<string, Map<number, number>> {
    const logs = getErrorLogs(startTime, endTime)
    const buckets = new Map<string, Map<number, number>>()

    logs.forEach(log => {
        const bucketTime = new Date(
            Math.floor(log.timestamp.getTime() / bucketMs) * bucketMs
        )
        const bucketKey = bucketTime.toISOString().slice(0, 13) + ':00:00'

        if (!buckets.has(bucketKey)) {
            buckets.set(bucketKey, new Map<number, number>())
        }

        const bucket = buckets.get(bucketKey)!
        bucket.set(log.statusCode, (bucket.get(log.statusCode) || 0) + 1)
    })

    return buckets
}

