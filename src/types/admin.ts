/**
 * Shared admin type definitions
 * Used across AdminClient.tsx and useAdminQueries.ts
 */

import type { Prisma } from '@prisma/client'

// Cron Execution types
export interface CronExecution {
    id: string
    jobName: string
    status: 'RUNNING' | 'SUCCESS' | 'FAILED'
    startedAt: string | Date
    completedAt?: string | Date | null
    durationMs?: number | null
    result?: Record<string, unknown> | null
    error?: string | null
    triggeredBy: string
    [key: string]: unknown
}

export interface CronJob {
    name: string
    description: string
    schedule: string
    endpoint?: string
    [key: string]: unknown
}

// Admin Game types
export interface AdminGame {
    airDate?: string | Date | null
    category?: { name: string }
    round?: 'SINGLE' | 'DOUBLE' | 'FINAL'
    isDoubleJeopardy?: boolean
    isFinalJeopardy?: boolean
    gameId?: string
    questionCount?: number
    currentScore?: number
    currentRound?: string
    status?: string
    categories?: Array<{ id: string; name: string }>
    id?: string
    seed?: string
    userId?: string
    user?: {
        id: string
        email: string | null
        displayName: string | null
    }
    answeredQuestions?: number
    correctQuestions?: number
    totalQuestionRecords?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    config?: Record<string, unknown>
    visibility?: string
    [key: string]: unknown
}

// Dispute types
export interface AdminDispute {
    id: string
    userId: string
    questionId: string
    userAnswer: string
    mode: 'GAME' | 'PRACTICE' | 'DAILY_CHALLENGE'
    round: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    adminComment?: string | null
    adminId?: string | null
    createdAt: string | Date
    resolvedAt?: string | Date | null
    user?: {
        id: string
        displayName: string | null
        name: string | null
        email: string | null
    }
    admin?: {
        id: string
        displayName: string | null
        name: string | null
    } | null
    question?: {
        id: string
        question: string
        answer: string
        value: number
        round: string
        category?: {
            id: string
            name: string
        }
    }
    override?: {
        id: string
        text: string
    } | null
    category?: string
    questionPreview?: string
    systemWasCorrect?: boolean
    userName?: string
    [key: string]: unknown
}

// Issue types
export interface AdminIssue {
    id: string
    userId: string
    subject: string
    description: string
    category: 'BUG' | 'CONTENT' | 'FEATURE_REQUEST' | 'ACCOUNT' | 'QUESTION' | 'OTHER'
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'
    adminNote?: string | null
    adminId?: string | null
    createdAt: string | Date
    resolvedAt?: string | Date | null
    user?: {
        id: string
        displayName: string | null
        name: string | null
        email: string | null
    }
    admin?: {
        id: string
        displayName: string | null
        name: string | null
    } | null
    question?: {
        id: string
        question: string
        answer: string
        value: number
        round: string
        category?: {
            id: string
            name: string
        }
    } | null
    pageUrl?: string | null
    userName?: string
    userEmail?: string
    [key: string]: unknown
}

// User types
export interface AdminUser {
    id: string
    email: string | null
    name: string | null
    displayName: string | null
    createdAt: string | Date
    lastOnlineAt: string | Date | null
    lastSeenPath: string | null
    games?: AdminGame[]
    [key: string]: unknown
}

// Daily Challenge types
export interface DailyChallengeEntry {
    id: string
    date: string | Date
    questionId: string
    airDate?: string | Date | null
    question?: {
        id: string
        question: string
        answer: string
        value: number
        round: string
        category?: {
            id: string
            name: string
        }
    }
    [key: string]: unknown
}

// User Daily Challenge Completion types (for user debug view)
export interface UserDailyChallengeEntry {
    id: string
    correct: boolean
    userAnswer?: string | null
    completedAt: string | Date
    challenge: {
        date: string | Date
        question?: {
            question: string
            answer: string
        }
    }
    [key: string]: unknown
}

// Guest Config types
export interface GuestConfig {
    id: string
    randomGameMaxQuestionsBeforeAuth: number
    randomQuestionMaxQuestionsBeforeAuth: number
    dailyChallengeGuestEnabled: boolean
    dailyChallengeGuestAppearsOnLeaderboard: boolean
    dailyChallengeMinLookbackDays: number
    timeToAuthenticateMinutes: number
}

export interface GuestStats {
    totalSessions: number
    activeSessions: number
    claimedSessions: number
    byType: Record<string, number>
}

// Usage Metrics types
export interface UsageMetrics {
    window: string
    timestamp: string
    totalUsers?: number
    activeUsers?: number
    newUsers?: number
    totalGames?: number
    completedGames?: number
    totalQuestions?: number
    [key: string]: unknown
}

// Calendar Stats types
export interface CalendarStats {
    filledDates: string[]
    missingDates: string[]
    totalFilled: number
    totalMissing: number
    coverage: number
}

// Achievement types
export interface AdminAchievement {
    id: string
    code: string
    name: string
    description: string
    icon: string | null
    unlockedAt?: string | Date
    [key: string]: unknown
}

// Prisma WhereInput types for admin queries
export type DisputeWhereInput = Prisma.AnswerDisputeWhereInput
export type IssueWhereInput = Prisma.IssueReportWhereInput
export type UserWhereInput = Prisma.UserWhereInput
export type GameWhereInput = Prisma.GameWhereInput
export type CronJobExecutionWhereInput = Prisma.CronJobExecutionWhereInput

// Achievement type for callbacks
export interface UnlockedAchievement {
    code: string
    name: string
    icon: string | null
    description: string
}
