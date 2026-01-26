/**
 * Practice-related type definitions
 * Used for transform functions and practice page components
 */

// Raw API response types for transform functions
export interface RawQuestion {
    id: string
    question: string
    answer: string
    value?: number
    categoryId?: string
    categoryName?: string
    originalCategory?: string
    airDate?: string | null
    gameHistory?: Array<{ timestamp: string; correct: boolean }>
    incorrectAttempts?: string[]
    answered?: boolean
    correct?: boolean
    isLocked?: boolean
    hasIncorrectAttempts?: boolean
}

export interface RawCategory {
    id: string
    name: string
    questions?: RawQuestion[]
    [key: string]: unknown
}

export interface AchievementStats {
    totalQuestions?: number
    totalTripleStumpers?: number
    totalGames?: number
    dailyChallengeStreak?: number
    categoryStats?: Record<string, number>
    finalJeopardyCorrect?: number
    accuracyStats?: { correct: number; total: number }
}
