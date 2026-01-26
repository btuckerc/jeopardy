/**
 * Simple LRU cache for game board and Final Jeopardy results.
 * 
 * This is effective in Docker Compose deployments where the server process
 * runs for extended periods. The cache reduces redundant database queries
 * when:
 * - Resuming a game (same board data is requested again)
 * - Refreshing the game page
 * - Multiple rounds using the same seed
 * 
 * Keys are deterministic based on gameId/seed + round, so the same game
 * configuration will always produce the same cache key.
 */

interface CacheEntry<T> {
    value: T
    timestamp: number
}

class LRUCache<T> {
    private cache = new Map<string, CacheEntry<T>>()
    private maxSize: number
    private ttlMs: number

    constructor(maxSize: number = 100, ttlMs: number = 5 * 60 * 1000) {
        this.maxSize = maxSize
        this.ttlMs = ttlMs
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key)
        if (!entry) return undefined

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key)
            return undefined
        }

        // Move to end (most recently used)
        this.cache.delete(key)
        this.cache.set(key, entry)
        return entry.value
    }

    set(key: string, value: T): void {
        // Delete if exists to update position
        this.cache.delete(key)

        // Evict oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value
            if (oldestKey) this.cache.delete(oldestKey)
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        })
    }

    has(key: string): boolean {
        const entry = this.cache.get(key)
        if (!entry) return false
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key)
            return false
        }
        return true
    }

    clear(): void {
        this.cache.clear()
    }

    get size(): number {
        return this.cache.size
    }
}

// Type definitions for cached data
export interface CachedCategory {
    id: string
    name: string
    questions: {
        id: string
        question: string
        answer: string
        value: number
        isDoubleJeopardy: boolean
        wasTripleStumper: boolean
        categoryId: string
    }[]
}

export interface CachedFinalJeopardy {
    id: string
    question: string
    answer: string
    category: {
        id: string
        name: string
    }
}

// Global cache instances (persist across requests in long-running server)
const boardCache = new LRUCache<CachedCategory[]>(200, 10 * 60 * 1000) // 10 min TTL
const finalJeopardyCache = new LRUCache<CachedFinalJeopardy>(200, 10 * 60 * 1000)

/**
 * Generate cache key for game board
 * Format: board:{gameId|seed}:{round}:{mode}
 */
export function getBoardCacheKey(params: {
    gameId?: string | null
    seed?: string | null
    round: 'SINGLE' | 'DOUBLE'
    mode: string | null
    date?: string | null
    categories?: string | null
    categoryIds?: string | null
}): string | null {
    // Only cache if we have a deterministic identifier (gameId or seed)
    const identifier = params.gameId || params.seed
    if (!identifier) return null

    // Build key from all relevant parameters
    const parts = [
        'board',
        identifier,
        params.round,
        params.mode || 'random'
    ]

    // Add mode-specific parameters
    if (params.mode === 'date' && params.date) {
        parts.push(params.date)
    } else if (params.mode === 'knowledge' && params.categories) {
        parts.push(params.categories)
    } else if (params.mode === 'custom' && params.categoryIds) {
        parts.push(params.categoryIds)
    }

    return parts.join(':')
}

/**
 * Generate cache key for Final Jeopardy
 * Format: fj:{gameId|seed}:{mode}
 */
export function getFinalJeopardyCacheKey(params: {
    gameId?: string | null
    seed?: string | null
    mode: string | null
    date?: string | null
    finalCategoryMode?: string | null
    finalCategoryId?: string | null
}): string | null {
    // Only cache if we have a deterministic identifier
    const identifier = params.gameId || params.seed
    if (!identifier) return null

    const parts = [
        'fj',
        identifier,
        params.mode || 'random',
        params.finalCategoryMode || 'shuffle'
    ]

    // Add mode-specific parameters
    if (params.date) {
        parts.push(params.date)
    }
    if (params.finalCategoryId) {
        parts.push(params.finalCategoryId)
    }

    return parts.join(':')
}

/**
 * Get cached board data
 */
export function getCachedBoard(key: string): CachedCategory[] | undefined {
    return boardCache.get(key)
}

/**
 * Cache board data
 */
export function setCachedBoard(key: string, data: CachedCategory[]): void {
    boardCache.set(key, data)
}

/**
 * Get cached Final Jeopardy data
 */
export function getCachedFinalJeopardy(key: string): CachedFinalJeopardy | undefined {
    return finalJeopardyCache.get(key)
}

/**
 * Cache Final Jeopardy data
 */
export function setCachedFinalJeopardy(key: string, data: CachedFinalJeopardy): void {
    finalJeopardyCache.set(key, data)
}

/**
 * Clear all game caches (useful for testing or admin operations)
 */
export function clearGameCaches(): void {
    boardCache.clear()
    finalJeopardyCache.clear()
}

/**
 * Get cache statistics for monitoring
 */
export function getGameCacheStats(): { board: number; finalJeopardy: number } {
    return {
        board: boardCache.size,
        finalJeopardy: finalJeopardyCache.size
    }
}

