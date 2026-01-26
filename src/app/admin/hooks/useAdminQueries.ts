'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query keys for cache management
export const adminQueryKeys = {
    apiMetrics: (window: string) => ['admin', 'api-metrics', window],
    dbMetrics: (window: string, model?: string) => ['admin', 'db-metrics', window, model],
    usageMetrics: (window: string) => ['admin', 'usage-metrics', window],
    opsMetrics: (window: string) => ['admin', 'ops-metrics', window],
    contentMetrics: () => ['admin', 'content-metrics'],
    abuseMetrics: (window: string) => ['admin', 'abuse-metrics', window],
    perfMetrics: (window: string) => ['admin', 'perf-metrics', window],
    userDebug: (userId: string) => ['admin', 'user-debug', userId],
    users: (params: object) => ['admin', 'users', params],
    disputes: (params: object) => ['admin', 'disputes', params],
    issues: (params: object) => ['admin', 'issues', params],
    cronJobs: (params: object) => ['admin', 'cron-jobs', params],
    guestStats: () => ['admin', 'guest-stats'],
    guestConfig: () => ['admin', 'guest-config'],
    calendarStats: () => ['admin', 'calendar-stats'],
    dailyChallenges: () => ['admin', 'daily-challenges'],
}

// Helper for fetching with error handling
async function fetchAdmin<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || 'Request failed')
    }
    return response.json()
}

// API Metrics hook
export function useApiMetrics(window: string = '24h') {
    return useQuery({
        queryKey: adminQueryKeys.apiMetrics(window),
        queryFn: () => fetchAdmin<ApiMetricsResponse>(`/api/admin/api-metrics?window=${window}`),
        staleTime: 30 * 1000, // 30 seconds
        refetchInterval: 60 * 1000, // Refetch every minute
    })
}

// DB Metrics hook
export function useDbMetrics(window: string = '24h', model?: string) {
    const params = new URLSearchParams({ window })
    if (model) params.append('model', model)
    
    return useQuery({
        queryKey: adminQueryKeys.dbMetrics(window, model),
        queryFn: () => fetchAdmin<DbMetricsResponse>(`/api/admin/db-metrics?${params}`),
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    })
}

// Usage Metrics hook
export function useUsageMetrics(window: string = '7d') {
    const bucket = window === '24h' ? 'hour' : 'day'
    return useQuery({
        queryKey: adminQueryKeys.usageMetrics(window),
        queryFn: () => fetchAdmin<UsageMetricsResponse>(`/api/admin/usage-metrics?window=${window}&bucket=${bucket}`),
        staleTime: 60 * 1000,
    })
}

// Ops Metrics hook
export function useOpsMetrics(window: string = '24h') {
    return useQuery({
        queryKey: adminQueryKeys.opsMetrics(window),
        queryFn: () => fetchAdmin<OpsMetricsResponse>(`/api/admin/ops-metrics?window=${window}`),
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    })
}

// Content Metrics hook
export function useContentMetrics() {
    return useQuery({
        queryKey: adminQueryKeys.contentMetrics(),
        queryFn: () => fetchAdmin<ContentMetricsResponse>('/api/admin/content-metrics'),
        staleTime: 5 * 60 * 1000, // 5 minutes - content doesn't change often
    })
}

// Abuse Metrics hook
export function useAbuseMetrics(window: string = '30d') {
    return useQuery({
        queryKey: adminQueryKeys.abuseMetrics(window),
        queryFn: () => fetchAdmin<AbuseMetricsResponse>(`/api/admin/abuse-metrics?window=${window}`),
        staleTime: 60 * 1000,
    })
}

// User Debug hook
export function useUserDebug(userId: string | null) {
    return useQuery({
        queryKey: adminQueryKeys.userDebug(userId || ''),
        queryFn: () => fetchAdmin<UserDebugResponse>(`/api/admin/user-debug/${userId}`),
        enabled: !!userId,
        staleTime: 30 * 1000,
    })
}

// Users list hook
export function useAdminUsers(params: {
    search?: string
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
} = {}) {
    const searchParams = new URLSearchParams()
    if (params.search) searchParams.append('search', params.search)
    if (params.limit) searchParams.append('limit', String(params.limit))
    if (params.offset) searchParams.append('offset', String(params.offset))
    if (params.sortBy) searchParams.append('sortBy', params.sortBy)
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder)

    return useQuery({
        queryKey: adminQueryKeys.users(params),
        queryFn: () => fetchAdmin<UsersResponse>(`/api/admin/users?${searchParams}`),
        staleTime: 30 * 1000,
    })
}

// Disputes list hook
export function useAdminDisputes(params: {
    status?: string
    mode?: string
    page?: number
    pageSize?: number
} = {}) {
    const searchParams = new URLSearchParams()
    if (params.status) searchParams.append('status', params.status)
    if (params.mode) searchParams.append('mode', params.mode)
    if (params.page) searchParams.append('page', String(params.page))
    if (params.pageSize) searchParams.append('pageSize', String(params.pageSize))

    return useQuery({
        queryKey: adminQueryKeys.disputes(params),
        queryFn: () => fetchAdmin<DisputesResponse>(`/api/admin/disputes?${searchParams}`),
        staleTime: 30 * 1000,
    })
}

// Issues list hook
export function useAdminIssues(params: {
    status?: string
    category?: string
    page?: number
    pageSize?: number
} = {}) {
    const searchParams = new URLSearchParams()
    if (params.status) searchParams.append('status', params.status)
    if (params.category) searchParams.append('category', params.category)
    if (params.page) searchParams.append('page', String(params.page))
    if (params.pageSize) searchParams.append('pageSize', String(params.pageSize))

    return useQuery({
        queryKey: adminQueryKeys.issues(params),
        queryFn: () => fetchAdmin<IssuesResponse>(`/api/admin/issues?${searchParams}`),
        staleTime: 30 * 1000,
    })
}

// Guest stats hook
export function useGuestStats() {
    return useQuery({
        queryKey: adminQueryKeys.guestStats(),
        queryFn: () => fetchAdmin<GuestStatsResponse>('/api/admin/guest-stats'),
        staleTime: 60 * 1000,
    })
}

// Guest config hook
export function useGuestConfig() {
    return useQuery({
        queryKey: adminQueryKeys.guestConfig(),
        queryFn: () => fetchAdmin<GuestConfigResponse>('/api/admin/guest-config'),
        staleTime: 5 * 60 * 1000,
    })
}

// Disputes stats hook (for badge counts)
export function useDisputesStats() {
    return useQuery({
        queryKey: ['admin', 'disputes-stats'],
        queryFn: () => fetchAdmin<{ pendingCount: number }>('/api/admin/disputes/stats'),
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    })
}

// Issues stats hook (for badge counts)
export function useIssuesStats() {
    return useQuery({
        queryKey: ['admin', 'issues-stats'],
        queryFn: () => fetchAdmin<{ openCount: number }>('/api/admin/issues/stats'),
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    })
}

// Cron jobs hook
export function useCronJobs(params: {
    jobName?: string
    status?: string
    limit?: number
} = {}) {
    const searchParams = new URLSearchParams()
    if (params.jobName && params.jobName !== 'all') searchParams.append('jobName', params.jobName)
    if (params.status && params.status !== 'all') searchParams.append('status', params.status)
    if (params.limit) searchParams.append('limit', String(params.limit))

    return useQuery({
        queryKey: adminQueryKeys.cronJobs(params),
        queryFn: () => fetchAdmin<CronJobsResponse>(`/api/admin/cron-jobs?${searchParams}`),
        staleTime: 30 * 1000,
    })
}

// Calendar stats hook
export function useCalendarStats() {
    return useQuery({
        queryKey: adminQueryKeys.calendarStats(),
        queryFn: () => fetchAdmin<CalendarStatsResponse>('/api/admin/calendar-stats'),
        staleTime: 5 * 60 * 1000,
    })
}

// =============================================================================
// Type definitions for API responses
// =============================================================================

interface ApiMetricsResponse {
    window: string
    timeSeries: Array<{
        timestamp: string
        requests: number
        errors: number
        errorRate: number
        p50: number
        p95: number
        p99: number
        avgDuration: number
    }>
    topRoutes: Array<{
        route: string
        requests: number
        errors: number
        errorRate: number
        p50: number
        p95: number
        p99: number
        avgDuration: number
        methods: string[]
    }>
    slowestRoutes: Array<{
        route: string
        requests: number
        p95: number
        p99: number
        maxDuration: number
    }>
    totals: {
        requests: number
        errors: number
        errorRate: number
        p50: number
        p95: number
        p99: number
        avgDuration: number
    }
    timestamp: string
}

interface DbMetricsResponse {
    window: string
    timeSeries: Array<{
        timestamp: string
        queries: number
        slowQueries: number
        errors: number
        p50: number
        p95: number
        avgDuration: number
    }>
    topOperations: Array<{
        model: string
        action: string
        queries: number
        slowQueries: number
        errors: number
        slowRate: number
        p50: number
        p95: number
        p99: number
        avgDuration: number
    }>
    slowestOperations: Array<{
        model: string
        action: string
        queries: number
        p95: number
        p99: number
        maxDuration: number
        slowRate: number
    }>
    recentSlowQueries: Array<{
        id: string
        timestamp: string
        model: string
        action: string
        durationMs: number
        success: boolean
        recordCount: number | null
        error: string | null
    }>
    totals: {
        queries: number
        slowQueries: number
        errors: number
        slowRate: number
        errorRate: number
        p50: number
        p95: number
        p99: number
        avgDuration: number
    }
    availableModels: string[]
    timestamp: string
}

interface UsageMetricsResponse {
    window: string
    bucket: string
    timeSeries: Array<{
        timestamp: string
        guestSessionsCreated: number
        guestSessionsClaimed: number
        guestQuestionsAnswered: number
        gamesStarted: number
        gamesCompleted: number
        guestGamesStarted: number
        dailyChallengeSubmissions: number
        newUsers: number
        activeUsers: number
    }>
    totals: Record<string, number>
    averages: Record<string, number>
    conversionRate: number
    totalUsers?: number
    activeUsers?: number
    newUsers?: number
    userbase: {
        totalUsers: number
        activeUsers30d: number
        newUsersInWindow: number
    }
    onboarding: {
        total: number
        withDisplayName: number
        withGames: number
        withDailyChallenges: number
        withAchievements: number
        profileCompleted: number
        playedGame: number
        triedDaily: number
        earnedAchievement: number
    }
    activity: {
        activeLastDay: number
        activeLastWeek: number
        activeLastMonth: number
        dormant: number
    }
}

interface OpsMetricsResponse {
    cronJobs: Array<{
        jobName: string
        displayName: string
        description: string
        schedule: string
        lastExecution: {
            status: string
            startedAt: string
            completedAt: string | null
            durationMs: number | null
            error: string | null
        } | null
        lastSuccess: {
            startedAt: string
            completedAt: string | null
            durationMs: number | null
        } | null
        lastFailure: {
            startedAt: string
            completedAt: string | null
            error: string | null
        } | null
        stats: {
            total: number
            successful: number
            failed: number
            running: number
            recentSuccessful: number
            recentFailed: number
            avgDurationMs: number | null
        }
        health: 'healthy' | 'unhealthy' | 'running'
    }>
    disputes: {
        pending: number
        recent24h: number
    }
    apiErrors: {
        timeSeries: Array<{
            timestamp: string
            status404: number
            status500: number
            other4xx: number
            other5xx: number
        }>
        totals: {
            status404: number
            status500: number
            other4xx: number
            other5xx: number
            total: number
        }
        window: string
    }
    overallHealth: 'healthy' | 'unhealthy' | 'running' | 'degraded'
    timestamp: string
}

interface ContentMetricsResponse {
    overview: {
        totalQuestions: number
        totalCategories: number
        questionsWithAirDate: number
        questionsWithoutAirDate: number
        tripleStumperCount: number
        tripleStumperRate: number
        dailyChallengesGenerated: number
    }
    distribution: {
        byRound: Array<{ round: string; count: number }>
        byKnowledgeCategory: Array<{ category: string; count: number }>
        byDifficulty: Array<{ difficulty: string; count: number }>
        bySeason: Array<{ season: number; count: number }>
        categoriesByKnowledge: Array<{ knowledgeCategory: string; count: number }>
    }
    coverage: {
        airDateRange: { earliest: string | null; latest: string | null }
        daysWithData: number
        totalDaysInRange: number
        coveragePercent: number
    }
    hotQuestions: Array<{
        id: string
        question: string
        answer: string
        value: number
        round: string
        category: string
        disputeCount: number
        issueCount: number
        totalIssues: number
    }>
    timestamp: string
}

interface AbuseMetricsResponse {
    window: string
    timeSeries: Array<{
        timestamp: string
        disputesCreated: number
        disputesResolved: number
        issuesCreated: number
        issuesResolved: number
    }>
    disputes: {
        summary: {
            totalInWindow: number
            pending: number
            approved: number
            rejected: number
        }
        byMode: Array<{ mode: string; count: number }>
        byRound: Array<{ round: string; count: number }>
        aging: Array<{
            id: string
            ageHours: number
            ageDays: number
            mode: string
            user: string
            questionPreview: string
            createdAt: string
        }>
        resolutionStats: {
            p50Hours: number
            p95Hours: number
            avgHours: number
        }
        sla: {
            within24h: number
            within48h: number
            within72h: number
            total: number
            pctWithin24h: number
            pctWithin48h: number
        }
    }
    issues: {
        summary: {
            totalInWindow: number
            open: number
            inProgress: number
            resolved: number
            dismissed: number
        }
        byCategory: Array<{ category: string; count: number }>
        aging: Array<{
            id: string
            ageHours: number
            ageDays: number
            status: string
            category: string
            subject: string
            user: string
            createdAt: string
        }>
        resolutionStats: {
            p50Hours: number
            p95Hours: number
            avgHours: number
        }
        sla: {
            within24h: number
            within48h: number
            within72h: number
            total: number
            pctWithin24h: number
            pctWithin48h: number
        }
    }
    timestamp: string
}

interface UserDebugResponse {
    user: {
        id: string
        clerkUserId: string | null
        email: string | null
        name: string | null
        displayName: string | null
        selectedIcon: string | null
        avatarBackground: string | null
        role: string
        createdAt: string
        updatedAt: string
        lastOnlineAt: string | null
        lastSeenPath: string | null
        currentStreak: number
        longestStreak: number
        lastGameDate: string | null
        spoilerBlockEnabled: boolean
        spoilerBlockDate: string | null
        lastSpoilerPrompt: string | null
    }
    stats: {
        games: { total: number; inProgress: number; completed: number; abandoned: number }
        dailyChallenges: { total: number; correct: number; accuracy: number }
        disputes: { total: number; pending: number; approved: number; rejected: number }
        recentHistory: { total: number; correct: number; accuracy: number; totalPoints: number }
        achievementsUnlocked: number
    }
    recentActivity: {
        games: any[]
        gameHistory: any[]
        dailyChallenges: any[]
        achievements: any[]
        disputes: any[]
        issueReports: any[]
        claimedGuestSessions: any[]
    }
}

interface UsersResponse {
    users: Array<{
        id: string
        email: string | null
        name: string | null
        displayName: string | null
        createdAt: string
        lastOnlineAt: string | null
        lastSeenPath: string | null
        games: any[]
    }>
    totalCount: number
    limit: number
    offset: number
}

interface DisputesResponse {
    disputes: any[]
    pagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
    }
}

interface IssuesResponse {
    issues: any[]
    pagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
    }
}

interface GuestStatsResponse {
    totalSessions: number
    activeSessions: number
    claimedSessions: number
    byType: Record<string, number>
}

interface GuestConfigResponse {
    id: string
    randomGameMaxQuestionsBeforeAuth: number
    randomQuestionMaxQuestionsBeforeAuth: number
    dailyChallengeGuestEnabled: boolean
    dailyChallengeGuestAppearsOnLeaderboard: boolean
    dailyChallengeMinLookbackDays: number
    timeToAuthenticateMinutes: number
}

interface CronJobsResponse {
    executions: any[]
    stats: Record<string, number>
    latestExecutions: Record<string, any>
    jobs: Record<string, any>
}

interface CalendarStatsResponse {
    filledDates: string[]
    missingDates: string[]
    totalFilled: number
    totalMissing: number
    coverage: number
}

export interface RouteMetric {
    route: string
    method: string
    statusCode: number
    durationMs: number
    timestamp: string
    errorCode?: string | null
    errorMessage?: string | null
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
    errorRate: number
    lastHourCount: number
    recentRequests: RouteMetric[]
}

interface PerfMetricsResponse {
    window: string
    timestamp: string
    totalRequests: number
    avgResponseTime: number
    errorRate: number
    slowestRoutes: RouteStats[]
    mostFrequentRoutes: RouteStats[]
    recentSlowRequests: RouteMetric[]
    routeStats: RouteStats[]
    recentErrors: RouteMetric[]
}

// Performance Metrics hook (database-backed historical metrics)
export function usePerfMetrics(window: string = '24h') {
    return useQuery({
        queryKey: adminQueryKeys.perfMetrics(window),
        queryFn: () => fetchAdmin<PerfMetricsResponse>(`/api/admin/perf-metrics?window=${window}`),
        staleTime: 30 * 1000, // 30 seconds
        refetchInterval: 60 * 1000, // Refetch every minute
    })
}

export type {
    ApiMetricsResponse,
    DbMetricsResponse,
    UsageMetricsResponse,
    OpsMetricsResponse,
    ContentMetricsResponse,
    AbuseMetricsResponse,
    PerfMetricsResponse,
    RouteStats,
    RouteMetric,
    UserDebugResponse,
    UsersResponse,
    DisputesResponse,
    IssuesResponse,
    GuestStatsResponse,
    GuestConfigResponse,
    CronJobsResponse,
    CalendarStatsResponse,
}

