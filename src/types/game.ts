/**
 * Game-related type definitions
 */

export interface GameConfig {
    finalJeopardyQuestionId?: string
    rounds?: {
        single?: boolean
        double?: boolean
        final?: boolean
    }
    mode?: string
    categories?: string[]
    categoryIds?: string[]
    date?: string
    finalCategoryMode?: string
    finalCategoryId?: string
    spoilerProtection?: {
        enabled?: boolean
        cutoffDate?: string | null
    }
    [key: string]: unknown
}
