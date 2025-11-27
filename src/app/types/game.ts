export type GameQuestion = {
    id: string
    question: string
    answer: string
    value: number
    category: string
    difficulty: 'EASY' | 'MEDIUM' | 'HARD'
}

export type GameCategory = {
    id: string
    name: string
    questions: GameQuestion[]
}

export type GameBoard = {
    categories: GameCategory[]
    currentRound: number
    score: number
    answeredQuestions: Set<string>
}

export type GameState = {
    board: GameBoard
    selectedQuestion: GameQuestion | null
    isAnswering: boolean
    showAnswer: boolean
    userAnswer: string
}

// =============================================================================
// Multiplayer-Ready Types
// =============================================================================

export type GameStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'
export type GameVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC'
export type JeopardyRound = 'SINGLE' | 'DOUBLE' | 'FINAL'

/**
 * Player in a game - used for both single and multiplayer games
 */
export type GamePlayer = {
    id: string
    displayName: string
    selectedIcon?: string | null
    avatarBackground?: string | null
    score: number
    isCurrentUser?: boolean
    /** In multiplayer: indicates whose turn it is */
    isActive?: boolean
}

/**
 * Game configuration - stored in Game.config JSON field
 */
export type GameConfig = {
    mode: 'random' | 'knowledge' | 'custom' | 'date'
    categories?: string[]      // Knowledge category names
    categoryIds?: string[]     // Custom category UUIDs
    date?: string              // Air date (YYYY-MM-DD)
    rounds: {
        single: boolean
        double: boolean
        final: boolean
    }
    finalCategoryMode?: 'shuffle' | 'byDate' | 'specificCategory'
    finalCategoryId?: string
}

/**
 * Full game state - returned from /api/games/[gameId]
 */
export type GameData = {
    id: string
    seed: string | null
    config: GameConfig
    status: GameStatus
    currentRound: JeopardyRound
    currentScore: number
    visibility: GameVisibility
    owner: {
        id: string
        displayName: string | null
        selectedIcon: string | null
        avatarBackground: string | null
    }
    isOwner: boolean
    questions: Record<string, {
        id: string
        answered: boolean
        correct: boolean | null
        questionId: string
        categoryId: string
        categoryName: string
    }>
    stats: {
        totalQuestions: number
        answeredQuestions: number
        correctQuestions: number
        percentComplete: number
    }
    createdAt: string
    updatedAt: string
    /** For future multiplayer: opponent info */
    opponent?: GamePlayer | null
}

/**
 * Resumable game summary - returned from /api/games/resumable
 */
export type ResumableGame = {
    id: string
    seed: string | null
    label: string
    status: GameStatus
    currentRound: JeopardyRound
    currentScore: number
    roundBadges: string[]
    categories: Array<{
        id: string
        name: string
        answeredCount: number
        totalCount: number
    }>
    progress: {
        totalQuestions: number
        answeredQuestions: number
        correctQuestions: number
        percentComplete: number
    }
    createdAt: string
    updatedAt: string
}

/**
 * Multiplayer game state (future use)
 * Extends single-player with turn-based mechanics
 */
export type MultiplayerGameState = {
    players: GamePlayer[]
    activePlayerId: string
    turnNumber: number
    /** Which player selected the current question */
    questionSelector?: string
}
