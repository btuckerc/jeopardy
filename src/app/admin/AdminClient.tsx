'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppUser } from '@/lib/clerk-auth'
import { SimpleLineChart } from './SimpleLineChart'

// Helper to format date string without timezone conversion
// Takes YYYY-MM-DD and returns formatted string like "November 5, 2025"
function formatDateString(dateStr: string): string {
    const [year, month, day] = dateStr.split('-')
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`
}

interface Question {
    question: string
    answer: string
    value: number
    category: string
    isDoubleJeopardy?: boolean
    isFinalJeopardy?: boolean
    round?: 'SINGLE' | 'DOUBLE' | 'FINAL'
    difficulty: string
    knowledgeCategory: string
    wasTripleStumper?: boolean
}

interface Category {
    name: string
    round: 'single' | 'double' | 'final'
    questions: Question[]
}

interface FetchedGame {
    gameId: string
    showNumber?: string
    airDate: string | null
    title: string
    questionCount: number
    categories: Category[]
    questions: Question[]
}

interface GameGroup {
    airDate: string
    singleJeopardy: Category[]
    doubleJeopardy: Category[]
    finalJeopardy: Category[]
    questionCount: number
}

interface AdminClientProps {
    user: AppUser
    initialGames: any[]
}

export default function AdminClient({ user, initialGames }: AdminClientProps) {
    // Admin status is already verified by the server component
    const [games, setGames] = useState<any[]>(initialGames)
    const [loading, setLoading] = useState(false)
    const [searching, setSearching] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [showBackToTop, setShowBackToTop] = useState(false)
    
    // Fetch game state
    const [fetchDate, setFetchDate] = useState('')
    const [fetchGameId, setFetchGameId] = useState('')
    const [fetchedGame, setFetchedGame] = useState<FetchedGame | null>(null)
    const [fetching, setFetching] = useState(false)
    const [pushing, setPushing] = useState(false)
    
    // Tab state
    const [activeTab, setActiveTab] = useState<'metrics' | 'manage' | 'fetch' | 'player-games' | 'disputes' | 'daily-challenges' | 'guest-config' | 'cron' | 'users'>('metrics')
    
    // Metrics tab state
    const [metricsWindow, setMetricsWindow] = useState<'24h' | '7d' | '14d' | '30d'>('7d')
    const [metricsLoading, setMetricsLoading] = useState(false)
    
    // Cron jobs state
    const [cronExecutions, setCronExecutions] = useState<any[]>([])
    const [cronStats, setCronStats] = useState<Record<string, number>>({})
    const [cronLatest, setCronLatest] = useState<Record<string, any>>({})
    const [cronJobs, setCronJobs] = useState<any>(null)
    const [loadingCronJobs, setLoadingCronJobs] = useState(false)
    const [triggeringJob, setTriggeringJob] = useState<string | null>(null)
    const [cronFilter, setCronFilter] = useState<'all' | 'daily-challenge' | 'fetch-questions' | 'fetch-games' | 'dispute-summary'>('all')
    const [cronStatusFilter, setCronStatusFilter] = useState<'all' | 'RUNNING' | 'SUCCESS' | 'FAILED'>('all')
    
    // Guest config state
    const [guestConfig, setGuestConfig] = useState<any>(null)
    const [guestStats, setGuestStats] = useState<any>(null)
    const [loadingGuestConfig, setLoadingGuestConfig] = useState(false)
    const [savingGuestConfig, setSavingGuestConfig] = useState(false)
    
    // Overview metrics state
    const [usageMetrics, setUsageMetrics] = useState<any>(null)
    const [opsMetrics, setOpsMetrics] = useState<any>(null)
    const [loadingOverview, setLoadingOverview] = useState(true)
    
    // Daily challenges state
    const [dailyChallenges, setDailyChallenges] = useState<any[]>([])
    const [dailyChallengesStats, setDailyChallengesStats] = useState<any>(null)
    const [loadingDailyChallenges, setLoadingDailyChallenges] = useState(false)
    const [generatingChallenges, setGeneratingChallenges] = useState(false)
    
    // Calendar state
    const [calendarStats, setCalendarStats] = useState<any>(null)
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)
    const [dateGameData, setDateGameData] = useState<any[]>([])
    const [loadingDateData, setLoadingDateData] = useState(false)

    // Player games management state
    const [playerGames, setPlayerGames] = useState<any[]>([])
    const [loadingPlayerGames, setLoadingPlayerGames] = useState(false)
    const [playerGamesFilter, setPlayerGamesFilter] = useState<'all' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'>('all')
    const [playerGamesUserIdFilter, setPlayerGamesUserIdFilter] = useState<string | null>(null)
    const [editingGame, setEditingGame] = useState<any>(null)
    const [editGameScore, setEditGameScore] = useState('')
    const [editGameRound, setEditGameRound] = useState('')
    const [editGameStatus, setEditGameStatus] = useState('')
    const [savingGameEdit, setSavingGameEdit] = useState(false)

    // Batch fetch state
    const [batchStartDate, setBatchStartDate] = useState('')
    const [batchEndDate, setBatchEndDate] = useState('')
    const [batchFetchedGames, setBatchFetchedGames] = useState<FetchedGame[]>([])
    const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set())
    const [batchFetching, setBatchFetching] = useState(false)
    const [batchPushing, setBatchPushing] = useState(false)
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)

    // Disputes state
    const [disputes, setDisputes] = useState<any[]>([])
    const [loadingDisputes, setLoadingDisputes] = useState(false)
    const [disputesError, setDisputesError] = useState<string | null>(null)
    const [disputeFilterStatus, setDisputeFilterStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING')
    const [disputeFilterMode, setDisputeFilterMode] = useState<'GAME' | 'PRACTICE' | 'DAILY_CHALLENGE' | ''>('')
    const [disputePage, setDisputePage] = useState(1)
    const [disputeTotalPages, setDisputeTotalPages] = useState(1)
    const [processingDisputeId, setProcessingDisputeId] = useState<string | null>(null)
    const [disputeAdminComment, setDisputeAdminComment] = useState<Record<string, string>>({})
    const [disputeOverrideText, setDisputeOverrideText] = useState<Record<string, string>>({})
    const [disputesLoaded, setDisputesLoaded] = useState(false)
    const [pendingDisputesCount, setPendingDisputesCount] = useState<number | null>(null)

    // User management state
    const [users, setUsers] = useState<any[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [usersError, setUsersError] = useState<string | null>(null)
    const [userSearch, setUserSearch] = useState('')
    const [userSortBy, setUserSortBy] = useState<'lastOnlineAt' | 'createdAt'>('lastOnlineAt')
    const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('desc')
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [userGamesExpanded, setUserGamesExpanded] = useState<Set<string>>(new Set())
    const [userAllGames, setUserAllGames] = useState<Record<string, any[]>>({})
    const [loadingUserGames, setLoadingUserGames] = useState<Set<string>>(new Set())
    const [showDeleteUserModal, setShowDeleteUserModal] = useState(false)
    const [deleteUserConfirmText, setDeleteUserConfirmText] = useState('')
    const [deletingUser, setDeletingUser] = useState(false)
    const [showSendEmailModal, setShowSendEmailModal] = useState(false)
    const [emailSubject, setEmailSubject] = useState('')
    const [emailBody, setEmailBody] = useState('')
    const [sendingEmail, setSendingEmail] = useState(false)
    const [showDisplayNameModal, setShowDisplayNameModal] = useState(false)
    const [displayNameAction, setDisplayNameAction] = useState<'reset' | 'edit' | null>(null)
    const [editDisplayNameValue, setEditDisplayNameValue] = useState('')
    const [updatingDisplayName, setUpdatingDisplayName] = useState(false)

    // Existing games management state
    const [filterStartDate, setFilterStartDate] = useState('')
    const [filterEndDate, setFilterEndDate] = useState('')
    const [selectedExistingDates, setSelectedExistingDates] = useState<Set<string>>(new Set())
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [refetching, setRefetching] = useState(false)
    const [showRefetchConfirm, setShowRefetchConfirm] = useState(false)
    
    // Calendar fetch modal state
    const [showCalendarFetchModal, setShowCalendarFetchModal] = useState(false)
    const [calendarFetchDate, setCalendarFetchDate] = useState<string | null>(null)
    const [calendarFetchedGame, setCalendarFetchedGame] = useState<FetchedGame | null>(null)
    const [calendarFetching, setCalendarFetching] = useState(false)
    const [calendarPushing, setCalendarPushing] = useState(false)

    // Handle scroll to show/hide back to top button
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400)
        }
        
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Helper function to render cron job result
    const renderCronResult = (result: any, jobName: string) => {
        // Special rendering for dispute-summary job
        if (jobName === 'dispute-summary' && result) {
            // Handle nested data structure (result.data) or direct result
            const data = result.data || result
            
            return (
                <div className="space-y-4">
                    {/* Summary Section */}
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Summary</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <div className="text-xs text-gray-600 uppercase">Total Disputes</div>
                                <div className="text-2xl font-bold text-gray-900">{data.pendingCount || data.summary?.totalDisputes || 0}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-600 uppercase">Recipients</div>
                                <div className="text-2xl font-bold text-gray-900">{data.recipientCount || 0}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-600 uppercase">Emails Sent</div>
                                <div className="text-2xl font-bold text-green-600">{data.successfulEmails || data.emailStatus?.sent || 0}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-600 uppercase">Failed</div>
                                <div className="text-2xl font-bold text-red-600">{data.failedEmails || data.emailStatus?.failed || 0}</div>
                            </div>
                        </div>
                    </div>

                    {/* By Mode Breakdown */}
                    {data.summary?.byMode && Object.keys(data.summary.byMode).length > 0 && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="font-semibold text-gray-900 mb-3">Disputes by Mode</h4>
                            <div className="flex flex-wrap gap-3">
                                {Object.entries(data.summary.byMode).map(([mode, count]: [string, any]) => (
                                    <div key={mode} className="bg-gray-50 px-4 py-2 rounded-lg">
                                        <div className="text-xs text-gray-600 uppercase">{mode.replace('_', ' ')}</div>
                                        <div className="text-xl font-bold text-gray-900">{count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Email Status */}
                    {data.emailStatus && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="font-semibold text-gray-900 mb-3">Email Recipients</h4>
                            <div className="space-y-2">
                                {data.emailStatus.recipients?.map((recipient: any, idx: number) => {
                                    const emailResult = data.emailStatus.results?.[idx]
                                    return (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                            <div>
                                                <div className="font-medium text-sm">{recipient.name}</div>
                                                <div className="text-xs text-gray-600">{recipient.email}</div>
                                            </div>
                                            {emailResult?.success ? (
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Sent</span>
                                            ) : (
                                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                                    Failed {emailResult?.error ? `: ${emailResult.error}` : ''}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Disputes List */}
                    {data.disputes && data.disputes.length > 0 && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="font-semibold text-gray-900 mb-3">Disputes ({data.disputes.length} shown)</h4>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {data.disputes.map((dispute: any, idx: number) => (
                                    <div key={idx} className="border-l-4 border-blue-500 pl-3 py-2 bg-gray-50 rounded-r">
                                        <div className="flex items-start justify-between mb-1">
                                            <div className="font-medium text-sm text-gray-900">#{idx + 1} - {dispute.userName}</div>
                                            <div className="text-xs text-gray-500">{dispute.createdAt}</div>
                                        </div>
                                        <div className="text-xs text-gray-600 space-y-1">
                                            <div><span className="font-medium">Mode:</span> {dispute.mode} | <span className="font-medium">Round:</span> {dispute.round}</div>
                                            <div><span className="font-medium">Category:</span> {dispute.category}</div>
                                            <div><span className="font-medium">Question:</span> {dispute.questionPreview}</div>
                                            <div><span className="font-medium">User Answer:</span> {dispute.userAnswer}</div>
                                            <div>
                                                <span className={`px-2 py-0.5 rounded text-xs ${dispute.systemWasCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    System: {dispute.systemWasCorrect ? 'Correct' : 'Incorrect'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Message */}
                    {data.message && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                            <div className="text-sm text-blue-900">{data.message}</div>
                        </div>
                    )}

                    {/* Raw JSON fallback */}
                    <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                            View Raw JSON
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto break-words whitespace-pre-wrap text-gray-900">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </details>
                </div>
            )
        }

        // Default JSON rendering for other jobs
        return (
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto break-words whitespace-pre-wrap text-gray-900">
                {JSON.stringify(result, null, 2)}
            </pre>
        )
    }

    // Function to fetch calendar stats
    const fetchCalendarStats = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/calendar-stats')
            const data = await res.json()
            setCalendarStats(data)
        } catch (error) {
            console.error('Error fetching calendar stats:', error)
        }
    }, [])

    // Load calendar stats on mount
    useEffect(() => {
        fetchCalendarStats()
    }, [fetchCalendarStats])

    // Fetch player games
    const fetchPlayerGames = useCallback(async () => {
        setLoadingPlayerGames(true)
        try {
            const params = new URLSearchParams()
            if (playerGamesFilter !== 'all') {
                params.append('status', playerGamesFilter)
            }
            if (playerGamesUserIdFilter) {
                params.append('userId', playerGamesUserIdFilter)
            }
            params.append('limit', '100')
            
            const response = await fetch(`/api/admin/player-games?${params}`)
            if (response.ok) {
                const data = await response.json()
                setPlayerGames(data.games || [])
            }
        } catch (error) {
            console.error('Error fetching player games:', error)
        } finally {
            setLoadingPlayerGames(false)
        }
    }, [playerGamesFilter, playerGamesUserIdFilter])

    // Load player games when tab is active or filters change
    useEffect(() => {
        if (activeTab === 'player-games') {
            fetchPlayerGames()
        }
    }, [activeTab, playerGamesFilter, playerGamesUserIdFilter, fetchPlayerGames])

    // Fetch users
    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true)
        setUsersError(null)
        try {
            const params = new URLSearchParams()
            if (userSearch) {
                params.append('search', userSearch)
            }
            params.append('limit', '100')
            params.append('sortBy', userSortBy)
            params.append('sortOrder', userSortOrder)
            
            const response = await fetch(`/api/admin/users?${params}`)
            if (response.ok) {
                const data = await response.json()
                setUsers(data.users || [])
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fetch users' }))
                setUsersError(errorData.error || 'Failed to fetch users')
            }
        } catch (error) {
            console.error('Error fetching users:', error)
            setUsersError('Failed to fetch users')
        } finally {
            setLoadingUsers(false)
        }
    }, [userSearch, userSortBy, userSortOrder])

    // Load users when tab is active or sort changes
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers()
        }
    }, [activeTab, userSortBy, userSortOrder, fetchUsers])

    // Fetch all games for a specific user
    const fetchUserAllGames = useCallback(async (userId: string) => {
        if (userAllGames[userId] || loadingUserGames.has(userId)) {
            return // Already loaded or loading
        }

        setLoadingUserGames(prev => new Set(prev).add(userId))
        try {
            const params = new URLSearchParams()
            params.append('userId', userId)
            params.append('limit', '100')
            
            const response = await fetch(`/api/admin/player-games?${params}`)
            if (response.ok) {
                const data = await response.json()
                setUserAllGames(prev => ({ ...prev, [userId]: data.games || [] }))
            }
        } catch (error) {
            console.error('Error fetching user games:', error)
        } finally {
            setLoadingUserGames(prev => {
                const next = new Set(prev)
                next.delete(userId)
                return next
            })
        }
    }, [userAllGames, loadingUserGames])

    // Navigate to Games tab filtered by user
    const navigateToUserGames = useCallback((userId: string) => {
        setPlayerGamesUserIdFilter(userId)
        setActiveTab('player-games')
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    // Navigate to Users tab and highlight user
    const navigateToUser = useCallback((userId: string) => {
        setActiveTab('users')
        // Scroll to top and fetch users if needed
        window.scrollTo({ top: 0, behavior: 'smooth' })
        if (users.length === 0) {
            fetchUsers()
        }
    }, [users.length, fetchUsers])

    // Navigation helpers for metrics integration
    const navigateToDisputes = useCallback(() => {
        setActiveTab('disputes')
        setDisputeFilterStatus('PENDING')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    const navigateToCronJobs = useCallback(() => {
        setActiveTab('cron')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    const navigateToUsers = useCallback(() => {
        setActiveTab('users')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        if (users.length === 0) {
            fetchUsers()
        }
    }, [users.length, fetchUsers])

    const navigateToGames = useCallback(() => {
        setActiveTab('player-games')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    // Fetch guest config and stats (defined before navigateToGuestConfig to avoid initialization error)
    const fetchGuestConfig = useCallback(async () => {
        setLoadingGuestConfig(true)
        try {
            const [configRes, statsRes] = await Promise.all([
                fetch('/api/admin/guest-config'),
                fetch('/api/admin/guest-stats')
            ])
            if (configRes.ok) {
                const config = await configRes.json()
                setGuestConfig(config)
            }
            if (statsRes.ok) {
                const stats = await statsRes.json()
                setGuestStats(stats)
            }
        } catch (error) {
            console.error('Error fetching guest config/stats:', error)
        } finally {
            setLoadingGuestConfig(false)
        }
    }, [])

    const navigateToGuestConfig = useCallback(() => {
        setActiveTab('guest-config')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        if (!guestConfig) {
            fetchGuestConfig()
        }
    }, [guestConfig, fetchGuestConfig])

    // Fetch overview metrics (usage and ops)
    const fetchOverviewMetrics = useCallback(async (window: '24h' | '7d' | '14d' | '30d' = '7d') => {
        setLoadingOverview(true)
        setMetricsLoading(true)
        try {
            const bucket = window === '24h' ? 'hour' : 'day'
            const [usageRes, opsRes, guestStatsRes, disputesRes] = await Promise.all([
                fetch(`/api/admin/usage-metrics?window=${window}&bucket=${bucket}`),
                fetch(`/api/admin/ops-metrics?window=${window}`),
                fetch('/api/admin/guest-stats'),
                fetch('/api/admin/disputes/stats')
            ])
            
            if (usageRes.ok) {
                const usage = await usageRes.json()
                setUsageMetrics(usage)
            }
            if (opsRes.ok) {
                const ops = await opsRes.json()
                setOpsMetrics(ops)
            }
            if (guestStatsRes.ok) {
                const stats = await guestStatsRes.json()
                setGuestStats(stats)
            }
            if (disputesRes.ok) {
                const disputes = await disputesRes.json()
                setPendingDisputesCount(disputes.pendingCount || 0)
            }
        } catch (error) {
            console.error('Error fetching overview metrics:', error)
        } finally {
            setLoadingOverview(false)
            setMetricsLoading(false)
        }
    }, [])
    
    // Fetch metrics when window changes
    useEffect(() => {
        if (activeTab === 'metrics') {
            fetchOverviewMetrics(metricsWindow)
        }
    }, [metricsWindow, activeTab, fetchOverviewMetrics])
    
    // Load overview metrics on mount (for metrics tab)
    useEffect(() => {
        if (activeTab === 'metrics') {
            fetchOverviewMetrics(metricsWindow)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Only run on mount
    
    // Load metrics when switching to metrics tab
    useEffect(() => {
        if (activeTab === 'metrics' && !usageMetrics) {
            fetchOverviewMetrics(metricsWindow)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]) // Only depend on activeTab to avoid unnecessary refetches

    // Load guest config when tab is active
    useEffect(() => {
        if (activeTab === 'guest-config' && !guestConfig) {
            fetchGuestConfig()
        }
    }, [activeTab, guestConfig, fetchGuestConfig])

    // Fetch disputes - using a ref to track loading state to avoid dependency issues
    const disputesFetchingRef = useRef(false)
    
    const fetchDisputes = useCallback(async () => {
        // Use ref to prevent concurrent fetches without causing re-renders
        if (disputesFetchingRef.current) return
        disputesFetchingRef.current = true
        
        setLoadingDisputes(true)
        setDisputesError(null)
        try {
            const params = new URLSearchParams()
            if (disputeFilterStatus) params.append('status', disputeFilterStatus)
            if (disputeFilterMode) params.append('mode', disputeFilterMode)
            params.append('page', disputePage.toString())
            params.append('pageSize', '20')

            const response = await fetch(`/api/admin/disputes?${params.toString()}`)
            if (!response.ok) {
                if (response.status === 403) {
                    setDisputesError('Admin access required')
                    return
                }
                throw new Error('Failed to load disputes')
            }

            const data = await response.json()
            setDisputes(data.disputes || [])
            setDisputeTotalPages(data.pagination?.totalPages || 1)
        } catch (error) {
            console.error('Error loading disputes:', error)
            setDisputesError('Failed to load disputes. The disputes table may not exist yet - run migrations.')
            setDisputes([])
        } finally {
            setLoadingDisputes(false)
            setDisputesLoaded(true) // Mark as loaded even on error to prevent infinite retries
            disputesFetchingRef.current = false
        }
    }, [disputeFilterStatus, disputeFilterMode, disputePage])

    // Load disputes when tab is active (only once per filter change)
    useEffect(() => {
        if (activeTab === 'disputes' && !disputesLoaded) {
            fetchDisputes()
        }
    }, [activeTab, disputesLoaded, fetchDisputes])

    // Fetch pending dispute count on mount
    useEffect(() => {
        fetch('/api/admin/disputes/stats')
            .then(res => {
                if (res.ok) {
                    return res.json()
                }
                return null
            })
            .then(data => {
                if (data?.pendingCount !== undefined) {
                    setPendingDisputesCount(data.pendingCount)
                }
            })
            .catch(error => {
                console.error('Error fetching dispute stats:', error)
                setPendingDisputesCount(null)
            })
    }, [])

    // Fetch cron jobs
    const fetchCronJobs = useCallback(async () => {
        setLoadingCronJobs(true)
        try {
            const params = new URLSearchParams()
            if (cronFilter !== 'all') {
                params.append('jobName', cronFilter)
            }
            if (cronStatusFilter !== 'all') {
                params.append('status', cronStatusFilter)
            }
            params.append('limit', '100')
            
            const response = await fetch(`/api/admin/cron-jobs?${params}`)
            if (!response.ok) {
                throw new Error('Failed to load cron jobs')
            }
            const data = await response.json()
            setCronExecutions(data.executions || [])
            setCronStats(data.stats || {})
            setCronLatest(data.latestExecutions || {})
            setCronJobs(data.jobs || {})
        } catch (error) {
            console.error('Error fetching cron jobs:', error)
            setMessage(`Error loading cron jobs: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setLoadingCronJobs(false)
        }
    }, [cronFilter, cronStatusFilter])

    // Load cron jobs when tab is active
    useEffect(() => {
        if (activeTab === 'cron') {
            fetchCronJobs()
        }
    }, [activeTab, fetchCronJobs])

    // Trigger cron job manually
    const triggerCronJob = async (jobName: string) => {
        setTriggeringJob(jobName)
        try {
            const response = await fetch(`/api/admin/cron-jobs/${jobName}/trigger`, {
                method: 'POST',
            })
            const data = await response.json()
            if (data.success) {
                setMessage(`Successfully triggered ${jobName}`)
                // Refresh cron jobs list
                await fetchCronJobs()
            } else {
                setMessage(`Error triggering ${jobName}: ${data.error || 'Unknown error'}`)
            }
        } catch (error) {
            setMessage(`Error triggering ${jobName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setTriggeringJob(null)
        }
    }

    // Fetch daily challenges
    const fetchDailyChallenges = useCallback(async () => {
        setLoadingDailyChallenges(true)
        try {
            const response = await fetch('/api/admin/daily-challenges')
            if (!response.ok) {
                throw new Error('Failed to load daily challenges')
            }
            const data = await response.json()
            setDailyChallenges(data.challenges || [])
            setDailyChallengesStats(data.stats || null)
        } catch (error) {
            console.error('Error loading daily challenges:', error)
        } finally {
            setLoadingDailyChallenges(false)
        }
    }, [])

    // Load daily challenges when tab is active
    useEffect(() => {
        if (activeTab === 'daily-challenges' && dailyChallenges.length === 0 && !loadingDailyChallenges) {
            fetchDailyChallenges()
        }
    }, [activeTab, dailyChallenges.length, loadingDailyChallenges, fetchDailyChallenges])

    // Track if we've ever loaded disputes (to avoid resetting on initial mount)
    const disputesEverLoadedRef = useRef(false)
    
    // Reset disputesLoaded when filters change (but not on initial mount)
    useEffect(() => {
        if (disputesEverLoadedRef.current) {
            setDisputesLoaded(false)
        }
    }, [disputeFilterStatus, disputeFilterMode, disputePage])
    
    // Track when disputes have been loaded at least once
    useEffect(() => {
        if (disputesLoaded) {
            disputesEverLoadedRef.current = true
        }
    }, [disputesLoaded])

    // Handle approve dispute
    const handleApproveDispute = async (disputeId: string) => {
        if (processingDisputeId) return
        
        setProcessingDisputeId(disputeId)
        try {
            const response = await fetch(`/api/admin/disputes/${disputeId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminComment: disputeAdminComment[disputeId] || undefined,
                    overrideText: disputeOverrideText[disputeId] || undefined
                })
            })

            if (!response.ok) {
                const error = await response.json()
                alert(error.error || 'Failed to approve dispute')
                return
            }

            // Clear inputs and reload
            setDisputeAdminComment(prev => {
                const next = { ...prev }
                delete next[disputeId]
                return next
            })
            setDisputeOverrideText(prev => {
                const next = { ...prev }
                delete next[disputeId]
                return next
            })
            setDisputesLoaded(false)
        } catch (error) {
            console.error('Error approving dispute:', error)
            alert('Failed to approve dispute')
        } finally {
            setProcessingDisputeId(null)
        }
    }

    // Handle reject dispute
    const handleRejectDispute = async (disputeId: string) => {
        if (processingDisputeId) return
        
        setProcessingDisputeId(disputeId)
        try {
            const response = await fetch(`/api/admin/disputes/${disputeId}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminComment: disputeAdminComment[disputeId] || undefined
                })
            })

            if (!response.ok) {
                const error = await response.json()
                alert(error.error || 'Failed to reject dispute')
                return
            }

            // Clear inputs and reload
            setDisputeAdminComment(prev => {
                const next = { ...prev }
                delete next[disputeId]
                return next
            })
            setDisputesLoaded(false)
        } catch (error) {
            console.error('Error rejecting dispute:', error)
            alert('Failed to reject dispute')
        } finally {
            setProcessingDisputeId(null)
        }
    }

    // Handle editing a game
    const handleEditGame = (game: any) => {
        setEditingGame(game)
        setEditGameScore(String(game.currentScore))
        setEditGameRound(game.currentRound)
        setEditGameStatus(game.status)
    }

    const handleSaveGameEdit = async () => {
        if (!editingGame) return
        
        setSavingGameEdit(true)
        try {
            const response = await fetch('/api/admin/player-games', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameId: editingGame.id,
                    updates: {
                        currentScore: parseInt(editGameScore),
                        currentRound: editGameRound,
                        status: editGameStatus
                    }
                })
            })

            if (response.ok) {
                setMessage('Game updated successfully')
                setEditingGame(null)
                fetchPlayerGames()
            } else {
                const error = await response.json()
                setMessage(error.error || 'Failed to update game')
            }
        } catch (error) {
            console.error('Error updating game:', error)
            setMessage('Error updating game')
        } finally {
            setSavingGameEdit(false)
        }
    }

    const handleDeleteGame = async (gameId: string) => {
        if (!confirm('Are you sure you want to delete this game? This cannot be undone.')) {
            return
        }

        try {
            const response = await fetch('/api/admin/player-games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'deleteGame',
                    gameId
                })
            })

            if (response.ok) {
                setMessage('Game deleted successfully')
                fetchPlayerGames()
            } else {
                const error = await response.json()
                setMessage(error.error || 'Failed to delete game')
            }
        } catch (error) {
            console.error('Error deleting game:', error)
            setMessage('Error deleting game')
        }
    }

    // Load/filter existing games from database
    const loadExistingGames = async () => {
        setSearching(true)
        setMessage('')
        setSelectedExistingDates(new Set())
        
        try {
            const params = new URLSearchParams()
            if (filterStartDate) params.append('startDate', filterStartDate)
            if (filterEndDate) params.append('endDate', filterEndDate)

            const response = await fetch(`/api/admin/games?${params}`)
            if (response.ok) {
                const data = await response.json()
                setGames(data.games || [])
                const uniqueDates = new Set(
                    (data.games || [])
                        .map((g: any) => g.airDate ? new Date(g.airDate).toISOString().split('T')[0] : null)
                        .filter(Boolean)
                )
                setMessage(`Found ${data.games?.length || 0} questions across ${uniqueDates.size} dates`)
            } else {
                const errorData = await response.json().catch(() => ({}))
                setMessage(errorData.error || 'Error loading games')
            }
        } catch (error) {
            console.error('Error loading games:', error)
            setMessage('Error loading games. Please try again.')
        } finally {
            setSearching(false)
        }
    }

    // Toggle selection of a date's games
    const toggleExistingDateSelection = (dateStr: string) => {
        setSelectedExistingDates(prev => {
            const newSet = new Set(prev)
            if (newSet.has(dateStr)) {
                newSet.delete(dateStr)
            } else {
                newSet.add(dateStr)
            }
            return newSet
        })
    }

    // Select/deselect all dates
    const toggleSelectAllExisting = () => {
        const allDates = Object.keys(groupedGames)
        if (selectedExistingDates.size === allDates.length) {
            setSelectedExistingDates(new Set())
        } else {
            setSelectedExistingDates(new Set(allDates))
        }
    }

    // Get questions for selected dates
    const getQuestionsForSelectedDates = () => {
        return games.filter(g => {
            const dateStr = g.airDate ? new Date(g.airDate).toISOString().split('T')[0] : 'unknown'
            return selectedExistingDates.has(dateStr)
        })
    }

    const handleFetchGame = async () => {
        if (!fetchDate && !fetchGameId) {
            setMessage('Please provide either a date or game ID')
            return
        }

        setFetching(true)
        setFetchedGame(null)
        setMessage('')

        try {
            const params = new URLSearchParams()
            if (fetchDate) params.append('date', fetchDate)
            if (fetchGameId) params.append('gameId', fetchGameId)

            const response = await fetch(`/api/admin/fetch-game?${params}`)
            const data = await response.json()

            if (data.success && data.game) {
                setFetchedGame(data.game)
                setMessage(`Successfully fetched game: ${data.game.questionCount} questions`)
            } else {
                // Build a more helpful error message with the suggestion
                let errorMsg = data.message || 'Failed to fetch game'
                if (data.suggestion) {
                    errorMsg += `\n\n💡 Suggestion: ${data.suggestion}`
                }
                setMessage(errorMsg)
            }
        } catch (error) {
            console.error('Error fetching game:', error)
            setMessage('Error fetching game. Please try again.')
        } finally {
            setFetching(false)
        }
    }

    const handlePushGame = async () => {
        if (!fetchedGame) {
            setMessage('No game data to push')
            return
        }

        setPushing(true)
        setMessage('')

        try {
            const response = await fetch('/api/admin/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'push',
                    data: { game: fetchedGame }
                })
            })

            const data = await response.json()

            if (response.ok) {
                setMessage(data.message || 'Game pushed successfully')
                setFetchedGame(null)
                setFetchDate('')
                setFetchGameId('')
                // Refresh calendar stats to show the new game
                await fetchCalendarStats()
            } else {
                setMessage(data.error || 'Error pushing game')
            }
        } catch (error) {
            console.error('Error pushing game:', error)
            setMessage('Error pushing game. Please try again.')
        } finally {
            setPushing(false)
        }
    }

    // Batch fetch games for a date range
    const handleBatchFetch = async () => {
        if (!batchStartDate || !batchEndDate) {
            setMessage('Please provide both start and end dates for batch fetch')
            return
        }

        if (batchStartDate > batchEndDate) {
            setMessage('Start date must be before end date')
            return
        }

        setBatchFetching(true)
        setBatchFetchedGames([])
        setSelectedGameIds(new Set())
        setMessage('')

        try {
            // Generate all dates in range
            const dates: string[] = []
            const currentDate = new Date(batchStartDate + 'T00:00:00')
            const endDateObj = new Date(batchEndDate + 'T00:00:00')
            
            while (currentDate <= endDateObj) {
                dates.push(currentDate.toISOString().split('T')[0])
                currentDate.setDate(currentDate.getDate() + 1)
            }

            setBatchProgress({ current: 0, total: dates.length })
            const fetchedGames: FetchedGame[] = []

            for (let i = 0; i < dates.length; i++) {
                const date = dates[i]
                setBatchProgress({ current: i + 1, total: dates.length })

                try {
                    const response = await fetch(`/api/admin/fetch-game?date=${date}`)
                    const data = await response.json()

                    if (data.success && data.game) {
                        fetchedGames.push(data.game)
                    }
                } catch (error) {
                    console.error(`Error fetching game for ${date}:`, error)
                }

                // Small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 500))
            }

            setBatchFetchedGames(fetchedGames)
            setMessage(`Fetched ${fetchedGames.length} games out of ${dates.length} dates`)
        } catch (error) {
            console.error('Error in batch fetch:', error)
            setMessage('Error during batch fetch')
        } finally {
            setBatchFetching(false)
            setBatchProgress(null)
        }
    }

    // Toggle game selection
    const toggleGameSelection = (gameId: string) => {
        setSelectedGameIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(gameId)) {
                newSet.delete(gameId)
            } else {
                newSet.add(gameId)
            }
            return newSet
        })
    }

    // Select/deselect all games
    const toggleSelectAll = () => {
        if (selectedGameIds.size === batchFetchedGames.length) {
            setSelectedGameIds(new Set())
        } else {
            setSelectedGameIds(new Set(batchFetchedGames.map(g => g.gameId)))
        }
    }

    // Push selected games to database
    const handleBatchPush = async () => {
        if (selectedGameIds.size === 0) {
            setMessage('Please select at least one game to push')
            return
        }

        setBatchPushing(true)
        setMessage('')

        const selectedGames = batchFetchedGames.filter(g => selectedGameIds.has(g.gameId))
        let successCount = 0
        let errorCount = 0

        for (const game of selectedGames) {
            try {
                const response = await fetch('/api/admin/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'push',
                        data: { game }
                    })
                })

                if (response.ok) {
                    successCount++
                } else {
                    errorCount++
                }
            } catch (error) {
                console.error(`Error pushing game ${game.gameId}:`, error)
                errorCount++
            }
        }

        setMessage(`Pushed ${successCount} games successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`)
        
        // Remove pushed games from the list
        setBatchFetchedGames(prev => prev.filter(g => !selectedGameIds.has(g.gameId)))
        setSelectedGameIds(new Set())
        
        // Refresh calendar stats
        await fetchCalendarStats()
        setBatchPushing(false)
    }

    // Open delete confirmation modal
    const openDeleteConfirmation = () => {
        if (selectedExistingDates.size === 0) {
            setMessage('Please select at least one date to delete')
            return
        }
        setShowDeleteConfirm(true)
        setDeleteConfirmText('')
    }

    // Confirm and delete selected games
    const handleConfirmDelete = async () => {
        if (deleteConfirmText !== 'DELETE') {
            setMessage('Please type DELETE to confirm')
            return
        }

        setDeleting(true)
        setMessage('')

        try {
            const selectedDates = Array.from(selectedExistingDates)
            let deletedCount = 0

            for (const dateStr of selectedDates) {
                const response = await fetch('/api/admin/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'delete',
                        data: {
                            startDate: dateStr,
                            endDate: dateStr
                        }
                    })
                })

                if (response.ok) {
                    deletedCount++
                }
            }

            setMessage(`Successfully deleted games from ${deletedCount} date(s)`)
            setShowDeleteConfirm(false)
            setDeleteConfirmText('')
            setSelectedExistingDates(new Set())
            
            // Reload games and refresh calendar
            await loadExistingGames()
            await fetchCalendarStats()
        } catch (error) {
            console.error('Error deleting games:', error)
            setMessage('Error deleting games')
        } finally {
            setDeleting(false)
        }
    }

    // Open refetch confirmation
    const openRefetchConfirmation = () => {
        if (selectedExistingDates.size === 0) {
            setMessage('Please select at least one date to re-fetch')
            return
        }
        setShowRefetchConfirm(true)
    }

    // Re-fetch selected games
    const handleRefetchSelected = async () => {
        setShowRefetchConfirm(false)
        setRefetching(true)
        setMessage('')

        const dates = Array.from(selectedExistingDates)
        let successCount = 0
        let errorCount = 0

        for (const dateStr of dates) {
            try {
                // First delete existing questions for this date
                await fetch('/api/admin/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'delete',
                        data: { startDate: dateStr, endDate: dateStr }
                    })
                })

                // Then fetch fresh data
                const fetchResponse = await fetch(`/api/admin/fetch-game?date=${dateStr}`)
                const fetchData = await fetchResponse.json()

                if (fetchData.success && fetchData.game) {
                    // Push the new data
                    const pushResponse = await fetch('/api/admin/games', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'push',
                            data: { game: fetchData.game }
                        })
                    })

                    if (pushResponse.ok) {
                        successCount++
                    } else {
                        errorCount++
                    }
                } else {
                    errorCount++
                }

                // Small delay
                await new Promise(resolve => setTimeout(resolve, 500))
            } catch (error) {
                console.error(`Error re-fetching ${dateStr}:`, error)
                errorCount++
            }
        }

        setMessage(`Successfully re-fetched ${successCount} date(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`)
        setSelectedExistingDates(new Set())
        
        // Clear the games list since we've modified the data - user can reload if needed
        setGames([])
        
        // Refresh calendar stats only
        await fetchCalendarStats()
        setRefetching(false)
    }

    const handleCalendarDateClick = async (date: string) => {
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]
        
        // Don't allow clicking future dates
        if (date > todayStr) {
            return
        }

        setSelectedCalendarDate(date)
        const filledSet = new Set(calendarStats?.filledDates || [])
        const hasData = filledSet.has(date)

        if (hasData) {
            // Load game data for this date
            setLoadingDateData(true)
            try {
                const response = await fetch(`/api/admin/games?startDate=${date}&endDate=${date}`)
                if (response.ok) {
                    const data = await response.json()
                    setDateGameData(data.games || [])
                } else {
                    setMessage('Error loading game data for this date')
                    setDateGameData([])
                }
            } catch (error) {
                console.error('Error loading date data:', error)
                setMessage('Error loading game data')
                setDateGameData([])
            } finally {
                setLoadingDateData(false)
            }
        } else {
            // No data - clear any previous data
            setDateGameData([])
        }
    }

    const handleFetchMissingDate = async () => {
        if (!selectedCalendarDate) return
        
        // Open the calendar fetch modal and start fetching
        setCalendarFetchDate(selectedCalendarDate)
        setShowCalendarFetchModal(true)
        setCalendarFetchedGame(null)
        setCalendarFetching(true)
        
        try {
            const response = await fetch(`/api/admin/fetch-game?date=${selectedCalendarDate}`)
            const data = await response.json()

            if (data.success && data.game) {
                setCalendarFetchedGame(data.game)
            } else {
                setMessage(data.error || 'Failed to fetch game')
            }
        } catch (error) {
            console.error('Error fetching game:', error)
            setMessage('Error fetching game. Please try again.')
        } finally {
            setCalendarFetching(false)
        }
    }
    
    const handleCalendarPushGame = async () => {
        if (!calendarFetchedGame) return
        
        setCalendarPushing(true)
        
        try {
            const response = await fetch('/api/admin/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'push',
                    data: { game: calendarFetchedGame }
                })
            })

            const data = await response.json()

            if (response.ok) {
                setMessage(`Successfully added game from ${formatDateString(calendarFetchedGame.airDate || '')}`)
                setShowCalendarFetchModal(false)
                setCalendarFetchedGame(null)
                setCalendarFetchDate(null)
                setSelectedCalendarDate(null)
                setDateGameData([])
                await fetchCalendarStats()
            } else {
                setMessage(data.error || 'Error pushing game')
            }
        } catch (error) {
            console.error('Error pushing game:', error)
            setMessage('Error pushing game. Please try again.')
        } finally {
            setCalendarPushing(false)
        }
    }
    
    const closeCalendarFetchModal = () => {
        setShowCalendarFetchModal(false)
        setCalendarFetchedGame(null)
        setCalendarFetchDate(null)
    }

    // Group games by air date and round - create a helper function that can be reused
    const groupGamesByDate = (gameList: any[]): Record<string, GameGroup> => {
        return gameList.reduce((acc: Record<string, GameGroup>, game: any) => {
            const dateKey = game.airDate ? new Date(game.airDate).toISOString().split('T')[0] : 'unknown'
            
            if (!acc[dateKey]) {
                acc[dateKey] = {
                    airDate: dateKey,
                    singleJeopardy: [],
                    doubleJeopardy: [],
                    finalJeopardy: [],
                    questionCount: 0
                }
            }

            const categoryName = game.category?.name || 'Unknown'
            
            // Determine round - support both new 'round' field and legacy 'isDoubleJeopardy'/'isFinalJeopardy'
            let roundKey: 'singleJeopardy' | 'doubleJeopardy' | 'finalJeopardy' = 'singleJeopardy'
            let roundType: 'single' | 'double' | 'final' = 'single'
            
            if (game.round === 'FINAL' || game.isFinalJeopardy) {
                roundKey = 'finalJeopardy'
                roundType = 'final'
            } else if (game.round === 'DOUBLE' || game.isDoubleJeopardy) {
                roundKey = 'doubleJeopardy'
                roundType = 'double'
            }
            
            let categoryGroup = acc[dateKey][roundKey].find((c: Category) => c.name === categoryName)
            if (!categoryGroup) {
                categoryGroup = {
                    name: categoryName,
                    round: roundType,
                    questions: []
                }
                acc[dateKey][roundKey].push(categoryGroup)
            }

            categoryGroup.questions.push({
                question: game.question,
                answer: game.answer,
                value: game.value,
                category: categoryName,
                isDoubleJeopardy: game.isDoubleJeopardy || false,
                isFinalJeopardy: game.isFinalJeopardy || false,
                round: game.round,
                difficulty: game.difficulty,
                knowledgeCategory: game.knowledgeCategory
            })

            acc[dateKey].questionCount++
            return acc
        }, {})
    }

    const groupedGames = groupGamesByDate(games)
    
    // Also group dateGameData when it's loaded
    const dateGroupedGames = dateGameData.length > 0 ? groupGamesByDate(dateGameData) : {}

    const sortedGameGroups = Object.values(groupedGames).sort((a, b) => 
        b.airDate.localeCompare(a.airDate)
    )

    // Show error state if something goes wrong during data fetching
    if (error) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold text-black mb-4">Error</h1>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        )
    }

    return (
        // Allow horizontal scrolling within the admin area so mid-width layouts
        // (e.g., tablets, small laptops) never get content clipped even if a
        // child component slightly overflows.
        <div className="min-h-screen w-full overflow-x-auto">
            <div className="container mx-auto px-4 pt-4">
                <h1 className="text-2xl font-bold text-black mb-6">Admin Dashboard</h1>
            </div>

            {/* Tab Navigation - wraps on small screens, scrolls on very narrow widths */}
            <div className="mb-6 border-b border-gray-200 bg-gray-50 relative">
                <div className="pb-2 overflow-x-auto scrollbar-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex flex-wrap gap-2 px-4 py-2">
                        <button
                            onClick={() => setActiveTab('metrics')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap ${
                                activeTab === 'metrics'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Metrics
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap ${
                                activeTab === 'manage'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Question DB
                        </button>
                        <button
                            onClick={() => setActiveTab('fetch')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap ${
                                activeTab === 'fetch'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Fetch
                        </button>
                        <button
                            onClick={() => setActiveTab('player-games')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap ${
                                activeTab === 'player-games'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Games
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap ${
                                activeTab === 'users'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab('disputes')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap relative ${
                                activeTab === 'disputes'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Disputes
                            {pendingDisputesCount !== null && pendingDisputesCount > 0 && (
                                <span className={`absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-[1.25rem] px-1.5 rounded-full text-[0.7rem] font-bold flex items-center justify-center text-white shadow-md border-2 ${
                                    activeTab === 'disputes'
                                        ? 'bg-red-500 border-blue-600'
                                        : 'bg-red-600 border-white'
                                }`}>
                                    {pendingDisputesCount > 9 ? '9+' : pendingDisputesCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('daily-challenges')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap ${
                                activeTab === 'daily-challenges'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Daily
                        </button>
                        <button
                            onClick={() => setActiveTab('guest-config')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap ${
                                activeTab === 'guest-config'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Guests
                        </button>
                        <button
                            onClick={() => setActiveTab('cron')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-sm transition-all border-2 whitespace-nowrap ${
                                activeTab === 'cron'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                            }`}
                        >
                            Cron Jobs
                        </button>
                    </div>
                </div>
                {/* Scroll indicator gradient */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none md:hidden" />
            </div>
            
            {/* Main Content */}
            <div className="container mx-auto px-4 pb-4">

            {/* Message Display */}
            {message && (
                <div className={`mb-4 p-4 rounded whitespace-pre-wrap ${
                    message.includes('Error') || message.includes('Failed') || message.includes('not working')
                        ? 'bg-red-100 border border-red-400 text-red-700' 
                        : message.includes('Successfully')
                            ? 'bg-green-100 border border-green-400 text-green-700'
                            : 'bg-blue-100 border border-blue-400 text-blue-700'
                }`}>
                    {message}
                </div>
            )}

            {/* METRICS TAB */}
            {activeTab === 'metrics' && (
                <div className="container mx-auto px-4 pb-8">
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                            <h2 className="text-xl font-semibold text-black">Usage & Operational Metrics</h2>
                            <div className="flex flex-wrap gap-2">
                                {(['24h', '7d', '14d', '30d'] as const).map((window) => (
                                    <button
                                        key={window}
                                        onClick={() => setMetricsWindow(window)}
                                        disabled={metricsLoading}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border-2 ${
                                            metricsWindow === window
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {window}
                                    </button>
                                ))}
                                <button
                                    onClick={() => fetchOverviewMetrics(metricsWindow)}
                                    disabled={metricsLoading}
                                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {metricsLoading ? 'Loading...' : 'Refresh'}
                                </button>
                            </div>
                        </div>

                        {metricsLoading ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="mt-2 text-gray-600">Loading metrics...</p>
                            </div>
                        ) : (
                            <>
                                {/* Key Metrics Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                    {/* Total Users */}
                                    {usageMetrics?.userbase && (
                                        <button
                                            onClick={navigateToUsers}
                                            className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 text-left hover:bg-indigo-100 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group relative"
                                            title="Click to view all users"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-sm text-indigo-600 font-medium">Total Users</div>
                                                <svg className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                            <div className="text-2xl font-bold text-indigo-900">
                                                {usageMetrics.userbase.totalUsers?.toLocaleString() || '0'}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                Active (30d): {usageMetrics.userbase.activeUsers30d?.toLocaleString() || '0'}
                                            </div>
                                            <div className="absolute bottom-2 right-2 text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                View →
                                            </div>
                                        </button>
                                    )}
                                    
                                    {/* Questions Answered */}
                                    {usageMetrics && (
                                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                            <div className="text-sm text-green-600 font-medium mb-1">Questions ({metricsWindow})</div>
                                            <div className="text-2xl font-bold text-green-900">
                                                {((usageMetrics.totals?.guestQuestionsAnswered || 0) + (usageMetrics.totals?.gamesStarted || 0) * 10).toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                Guest: {usageMetrics.totals?.guestQuestionsAnswered || 0} | Games: {(usageMetrics.totals?.gamesStarted || 0) * 10}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Games Started vs Completed */}
                                    {usageMetrics && (
                                        <button
                                            onClick={navigateToGames}
                                            className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 text-left hover:bg-purple-100 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group relative"
                                            title="Click to view all games"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-sm text-purple-600 font-medium">Games ({metricsWindow})</div>
                                                <svg className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                            <div className="text-2xl font-bold text-purple-900">
                                                {(usageMetrics.totals?.gamesStarted || 0) + (usageMetrics.totals?.guestGamesStarted || 0)}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                Completed: {usageMetrics.totals?.gamesCompleted || 0} | Guest: {usageMetrics.totals?.guestGamesStarted || 0}
                                            </div>
                                            <div className="absolute bottom-2 right-2 text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                View →
                                            </div>
                                        </button>
                                    )}
                                    
                                    {/* API Errors */}
                                    {opsMetrics?.apiErrors && (
                                        <div className={`border-2 rounded-lg p-4 ${
                                            (opsMetrics.apiErrors.totals?.status500 || 0) > 0 
                                                ? 'bg-red-50 border-red-200' 
                                                : (opsMetrics.apiErrors.totals?.status404 || 0) > 10
                                                ? 'bg-yellow-50 border-yellow-200'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}>
                                            <div className={`text-sm font-medium mb-1 ${
                                                (opsMetrics.apiErrors.totals?.status500 || 0) > 0 
                                                    ? 'text-red-600' 
                                                    : (opsMetrics.apiErrors.totals?.status404 || 0) > 10
                                                    ? 'text-yellow-600'
                                                    : 'text-gray-600'
                                            }`}>
                                                API Errors ({metricsWindow})
                                            </div>
                                            <div className={`text-2xl font-bold ${
                                                (opsMetrics.apiErrors.totals?.status500 || 0) > 0 
                                                    ? 'text-red-900' 
                                                    : (opsMetrics.apiErrors.totals?.status404 || 0) > 10
                                                    ? 'text-yellow-900'
                                                    : 'text-gray-900'
                                            }`}>
                                                {opsMetrics.apiErrors.totals?.total || 0}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                404: {opsMetrics.apiErrors.totals?.status404 || 0} | 500: {opsMetrics.apiErrors.totals?.status500 || 0}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Guest Conversion & Pending Disputes */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    {/* Guest Conversion Rate */}
                                    {usageMetrics && (
                                        <button
                                            onClick={navigateToGuestConfig}
                                            className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-left hover:bg-blue-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group relative"
                                            title="Click to manage guest settings"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-sm text-blue-600 font-medium">Guest Conversion ({metricsWindow})</div>
                                                <svg className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                            <div className="text-2xl font-bold text-blue-900">
                                                {usageMetrics.conversionRate?.toFixed(1) || '0.0'}%
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                {usageMetrics.totals?.guestSessionsClaimed || 0} / {usageMetrics.totals?.guestSessionsCreated || 0} claimed
                                            </div>
                                            <div className="absolute bottom-2 right-2 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Manage →
                                            </div>
                                        </button>
                                    )}
                                    
                                    {/* Pending Disputes */}
                                    <button
                                        onClick={navigateToDisputes}
                                        className={`border-2 rounded-lg p-4 text-left transition-all cursor-pointer group relative hover:shadow-md ${
                                            (pendingDisputesCount || 0) > 0 
                                                ? 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300' 
                                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                        }`}
                                        title="Click to review pending disputes"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className={`text-sm font-medium ${
                                                (pendingDisputesCount || 0) > 0 ? 'text-amber-600' : 'text-gray-600'
                                            }`}>
                                                Pending Disputes
                                            </div>
                                            <svg className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${
                                                (pendingDisputesCount || 0) > 0 ? 'text-amber-400' : 'text-gray-400'
                                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <div className={`text-2xl font-bold ${
                                            (pendingDisputesCount || 0) > 0 ? 'text-amber-900' : 'text-gray-900'
                                        }`}>
                                            {pendingDisputesCount ?? '...'}
                                        </div>
                                        {(pendingDisputesCount || 0) > 0 && (
                                            <div className="absolute bottom-2 right-2 text-xs text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Review →
                                            </div>
                                        )}
                                    </button>
                                </div>

                                {/* Time-Series Charts */}
                                <div className="space-y-6">
                                    {/* User Growth Chart */}
                                    {usageMetrics?.timeSeries && (
                                        <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                                            <SimpleLineChart
                                                data={usageMetrics.timeSeries.map((d: any) => ({
                                                    timestamp: d.timestamp,
                                                    value: d.newUsers || 0
                                                }))}
                                                title="New Users Over Time"
                                                color="#6366f1"
                                            />
                                        </div>
                                    )}

                                    {/* Active Users Chart */}
                                    {usageMetrics?.timeSeries && (
                                        <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                                            <SimpleLineChart
                                                data={usageMetrics.timeSeries.map((d: any) => ({
                                                    timestamp: d.timestamp,
                                                    value: d.activeUsers || 0
                                                }))}
                                                title="Active Users Over Time"
                                                color="#10b981"
                                            />
                                        </div>
                                    )}

                                    {/* Questions Answered Chart */}
                                    {usageMetrics?.timeSeries && (
                                        <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                                            <SimpleLineChart
                                                data={usageMetrics.timeSeries.map((d: any) => ({
                                                    timestamp: d.timestamp,
                                                    value: (d.guestQuestionsAnswered || 0) + (d.gamesStarted || 0) * 10
                                                }))}
                                                title="Questions Answered Over Time"
                                                color="#22c55e"
                                            />
                                        </div>
                                    )}

                                    {/* Games Started Chart */}
                                    {usageMetrics?.timeSeries && (
                                        <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                                            <SimpleLineChart
                                                data={usageMetrics.timeSeries.map((d: any) => ({
                                                    timestamp: d.timestamp,
                                                    value: (d.gamesStarted || 0) + (d.guestGamesStarted || 0)
                                                }))}
                                                title="Games Started Over Time"
                                                color="#a855f7"
                                            />
                                        </div>
                                    )}

                                    {/* API Errors Chart */}
                                    {opsMetrics?.apiErrors?.timeSeries && opsMetrics.apiErrors.timeSeries.length > 0 && (
                                        <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                                            <SimpleLineChart
                                                data={opsMetrics.apiErrors.timeSeries.map((d: any) => ({
                                                    timestamp: d.timestamp,
                                                    value: (d.status404 || 0) + (d.status500 || 0) + (d.other4xx || 0) + (d.other5xx || 0)
                                                }))}
                                                title="API Errors Over Time"
                                                color="#ef4444"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Cron Job Health */}
                                {opsMetrics && (
                                    <div className="mt-6 pt-6 border-t border-gray-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-lg font-semibold text-black">Cron Job Health</h3>
                                            <button
                                                onClick={navigateToCronJobs}
                                                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                            >
                                                View Details
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            {opsMetrics.cronJobs?.map((job: any) => (
                                                <button
                                                    key={job.jobName}
                                                    onClick={navigateToCronJobs}
                                                    className={`border-2 rounded-lg p-3 text-left transition-all cursor-pointer group hover:shadow-md ${
                                                        job.health === 'unhealthy' 
                                                            ? 'bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300' 
                                                            : job.health === 'running'
                                                            ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100 hover:border-yellow-300'
                                                            : 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300'
                                                    }`}
                                                    title={`Click to view ${job.displayName} details`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="text-sm font-medium text-gray-900">{job.displayName}</div>
                                                        <svg className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${
                                                            job.health === 'unhealthy' 
                                                                ? 'text-red-400' 
                                                                : job.health === 'running'
                                                                ? 'text-yellow-400'
                                                                : 'text-green-400'
                                                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </div>
                                                    <div className={`text-xs font-semibold ${
                                                        job.health === 'unhealthy' 
                                                            ? 'text-red-700' 
                                                            : job.health === 'running'
                                                            ? 'text-yellow-700'
                                                            : 'text-green-700'
                                                    }`}>
                                                        {job.health === 'unhealthy' ? '⚠️ Unhealthy' :
                                                         job.health === 'running' ? '⏳ Running' : '✓ Healthy'}
                                                    </div>
                                                    {job.lastExecution && (
                                                        <div className="text-xs text-gray-600 mt-1">
                                                            Last: {new Date(job.lastExecution.startedAt).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* FETCH TAB */}
            {activeTab === 'fetch' && (
                <>
            {/* Fetch Game Section */}
            <div id="fetch-section" className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-black mb-4">Fetch Game from j-archive</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fetch by Date
                        </label>
                        <input
                            type="date"
                            value={fetchDate}
                            onChange={(e) => {
                                setFetchDate(e.target.value)
                                setFetchGameId('')
                            }}
                            className="w-full p-2 border rounded text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Or Fetch by Game ID
                        </label>
                        <input
                            type="text"
                            value={fetchGameId}
                            onChange={(e) => {
                                setFetchGameId(e.target.value)
                                setFetchDate('')
                            }}
                            className="w-full p-2 border rounded text-gray-900 placeholder-gray-500"
                            placeholder="e.g., 1234"
                        />
                    </div>
                </div>
                <button
                    onClick={handleFetchGame}
                    disabled={fetching || (!fetchDate && !fetchGameId)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {fetching ? 'Fetching...' : 'Fetch Game'}
                </button>

                {/* Display Fetched Game */}
                {fetchedGame && (
                    <div className="mt-6 p-4 bg-gray-50 rounded border">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-lg text-gray-900 break-words">{fetchedGame.title}</h3>
                                <p className="text-sm text-gray-800 flex flex-wrap gap-x-2 gap-y-1">
                                    <span>Air Date: {fetchedGame.airDate || 'Unknown'}</span>
                                    <span className="hidden sm:inline">|</span>
                                    <span>Game ID: {fetchedGame.gameId}</span>
                                    <span className="hidden sm:inline">|</span>
                                    <span>Questions: {fetchedGame.questionCount}</span>
                                </p>
                            </div>
                            <button
                                onClick={handlePushGame}
                                disabled={pushing}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                            >
                                {pushing ? 'Pushing...' : 'Push to Database'}
                            </button>
                        </div>

                        {/* Summary */}
                        <div className="mb-4 text-sm text-gray-700 flex flex-wrap gap-x-2 gap-y-1">
                            <span><span className="font-medium">Categories:</span> {fetchedGame.categories.length}</span>
                            <span className="hidden sm:inline">|</span>
                            <span><span className="font-medium">Single:</span> {fetchedGame.categories.filter((c: Category) => c.round === 'single').length}</span>
                            <span className="hidden sm:inline">|</span>
                            <span><span className="font-medium">Double:</span> {fetchedGame.categories.filter((c: Category) => c.round === 'double').length}</span>
                            <span className="hidden sm:inline">|</span>
                            <span><span className="font-medium">Final:</span> {fetchedGame.categories.filter((c: Category) => c.round === 'final').length}</span>
                        </div>

                        {/* Collapsible Categories - Scrollable */}
                        <div className="max-h-[32rem] overflow-y-auto space-y-2 border rounded p-2 bg-white">
                            {fetchedGame.categories.map((category, idx) => (
                                <CollapsibleCategory key={idx} category={category} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Batch Fetch Games Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-black mb-4">Batch Fetch Games</h2>
                <p className="text-gray-600 text-sm mb-4">
                    Fetch multiple games at once by specifying a date range. Games will be fetched from j-archive and you can select which ones to push to the database.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={batchStartDate}
                            onChange={(e) => setBatchStartDate(e.target.value)}
                            className="w-full p-2 border rounded text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={batchEndDate}
                            onChange={(e) => setBatchEndDate(e.target.value)}
                            className="w-full p-2 border rounded text-gray-900"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleBatchFetch}
                            disabled={batchFetching || !batchStartDate || !batchEndDate}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {batchFetching ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {batchProgress ? `Fetching ${batchProgress.current}/${batchProgress.total}...` : 'Fetching...'}
                                </>
                            ) : (
                                'Fetch Games'
                            )}
                        </button>
                    </div>
                </div>

                {/* Batch Fetched Games Display */}
                {batchFetchedGames.length > 0 && (
                    <div className="mt-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
                            <h3 className="font-bold text-lg text-gray-900">
                                Fetched Games ({batchFetchedGames.length})
                            </h3>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedGameIds.size === batchFetchedGames.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700">Select All</span>
                                </label>
                                <button
                                    onClick={handleBatchPush}
                                    disabled={batchPushing || selectedGameIds.size === 0}
                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                                >
                                    {batchPushing ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Pushing...</span>
                                        </>
                                    ) : (
                                        <span>Push Selected ({selectedGameIds.size})</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[32rem] overflow-y-auto space-y-3 border rounded p-3 bg-gray-50">
                            {batchFetchedGames.map((game) => (
                                <div 
                                    key={game.gameId} 
                                    className={`p-4 bg-white rounded border ${selectedGameIds.has(game.gameId) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedGameIds.has(game.gameId)}
                                            onChange={() => toggleGameSelection(game.gameId)}
                                            className="w-5 h-5 text-blue-600 rounded mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-semibold text-gray-900">{game.title || `Game ${game.gameId}`}</h4>
                                                    <p className="text-sm text-gray-700 flex flex-wrap gap-x-2 gap-y-1">
                                                        <span>Air Date: {game.airDate ? formatDateString(game.airDate) : 'Unknown'}</span>
                                                        <span className="hidden sm:inline">|</span>
                                                        <span>Game ID: {game.gameId}</span>
                                                        <span className="hidden sm:inline">|</span>
                                                        <span>Questions: {game.questionCount}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-sm text-gray-600">
                                                <span className="mr-3">Single: {game.categories.filter((c: Category) => c.round === 'single').length} categories</span>
                                                <span className="mr-3">Double: {game.categories.filter((c: Category) => c.round === 'double').length} categories</span>
                                                <span>Final: {game.categories.filter((c: Category) => c.round === 'final').length} categories</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
                </>
            )}

            {/* PLAYER GAMES TAB */}
            {activeTab === 'player-games' && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-xl font-semibold text-black mb-4">Player Games Management</h2>
                    <p className="text-gray-600 text-sm mb-4">
                        View and manage all player games. You can edit scores, rounds, and game status.
                    </p>

                    {/* Filter Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                        <label className="text-sm font-medium text-gray-700">Filter by status:</label>
                        <select
                            value={playerGamesFilter}
                            onChange={(e) => setPlayerGamesFilter(e.target.value as any)}
                            className="p-2 border rounded text-gray-900"
                        >
                            <option value="all">All</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="ABANDONED">Abandoned</option>
                        </select>
                        {playerGamesUserIdFilter && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                <span>Filtered by user</span>
                                <button
                                    onClick={() => {
                                        setPlayerGamesUserIdFilter(null)
                                    }}
                                    className="text-blue-600 hover:text-blue-900 font-bold"
                                    title="Clear user filter"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                        <button
                            onClick={fetchPlayerGames}
                            disabled={loadingPlayerGames}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loadingPlayerGames ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>

                    {/* Games List */}
                    {loadingPlayerGames ? (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="mt-2 text-gray-600">Loading player games...</p>
                        </div>
                    ) : playerGames.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No games found matching the filter.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {playerGames.map((game) => (
                                <div key={game.id} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-bold text-gray-900">
                                                    {game.user?.displayName || game.user?.email || 'Unknown User'}
                                                </span>
                                                {game.user?.id && (
                                                    <button
                                                        onClick={() => navigateToUser(game.user.id)}
                                                        className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs hover:bg-blue-700 whitespace-nowrap font-medium transition-colors"
                                                        aria-label={`View user details for ${game.user?.displayName || game.user?.email}`}
                                                    >
                                                        View User →
                                                    </button>
                                                )}
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                    game.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                                    game.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {game.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
                                                <span>Game ID: <code className="bg-gray-200 px-1 rounded text-xs">{game.id}</code></span>
                                                {game.seed && (
                                                    <>
                                                        <span className="hidden sm:inline">|</span>
                                                        <span>Seed: <code className="bg-gray-200 px-1 rounded text-xs">{game.seed}</code></span>
                                                    </>
                                                )}
                                            </p>
                                            <p className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
                                                <span>Mode: {game.config?.mode || 'unknown'}</span>
                                                <span className="hidden sm:inline">|</span>
                                                <span>Round: {game.currentRound}</span>
                                                <span className="hidden sm:inline">|</span>
                                                <span>Score: <span className={game.currentScore >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                    ${game.currentScore.toLocaleString()}
                                                </span></span>
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Questions answered: {game.answeredQuestions} ({game.correctQuestions} correct)
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                                                <span>Created: {new Date(game.createdAt).toLocaleString()}</span>
                                                <span className="hidden sm:inline">|</span>
                                                <span>Updated: {new Date(game.updatedAt).toLocaleString()}</span>
                                            </p>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleEditGame(game)}
                                                className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 whitespace-nowrap"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGame(game.id)}
                                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 whitespace-nowrap"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Categories */}
                                    {game.categories && game.categories.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500 mb-1">Categories:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {game.categories.map((cat: any) => (
                                                    <span
                                                        key={cat.id}
                                                        className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded"
                                                    >
                                                        {cat.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ANSWER DISPUTES TAB */}
            {activeTab === 'disputes' && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-xl font-semibold text-black mb-4">Answer Disputes</h2>
                    <p className="text-gray-600 text-sm mb-4">
                        Review and manage user disputes for incorrectly graded answers. Approving a dispute will add the user&apos;s answer as an acceptable override and retroactively credit them.
                    </p>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={disputeFilterStatus}
                                onChange={(e) => {
                                    setDisputeFilterStatus(e.target.value as any)
                                    setDisputePage(1)
                                }}
                                className="border rounded-lg px-3 py-2 text-gray-900"
                            >
                                <option value="">All</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                            <select
                                value={disputeFilterMode}
                                onChange={(e) => {
                                    setDisputeFilterMode(e.target.value as any)
                                    setDisputePage(1)
                                }}
                                className="border rounded-lg px-3 py-2 text-gray-900"
                            >
                                <option value="">All</option>
                                <option value="GAME">Game</option>
                                <option value="PRACTICE">Practice</option>
                                <option value="DAILY_CHALLENGE">Daily Challenge</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setDisputesLoaded(false)
                                }}
                                disabled={loadingDisputes}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loadingDisputes ? 'Loading...' : 'Refresh'}
                            </button>
                        </div>
                    </div>

                    {/* Error State */}
                    {disputesError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                            {disputesError}
                        </div>
                    )}

                    {/* Loading State */}
                    {loadingDisputes && disputes.length === 0 && (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="mt-2 text-gray-600">Loading disputes...</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loadingDisputes && !disputesError && disputes.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No disputes found matching the current filters.
                        </div>
                    )}

                    {/* Disputes List */}
                    {disputes.length > 0 && (
                        <div className="space-y-4">
                            {disputes.map((dispute: any) => (
                                <div key={dispute.id} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    dispute.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                    dispute.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {dispute.status}
                                                </span>
                                                <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                                    {dispute.mode}
                                                </span>
                                                <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                                                    {dispute.round}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                User: {dispute.user?.displayName || dispute.user?.email || 'Unknown'}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Submitted: {new Date(dispute.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        {dispute.status === 'PENDING' && (
                                            <div className="flex gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => handleApproveDispute(dispute.id)}
                                                    disabled={processingDisputeId === dispute.id}
                                                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm whitespace-nowrap"
                                                >
                                                    {processingDisputeId === dispute.id ? 'Processing...' : 'Approve'}
                                                </button>
                                                <button
                                                    onClick={() => handleRejectDispute(dispute.id)}
                                                    disabled={processingDisputeId === dispute.id}
                                                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm whitespace-nowrap"
                                                >
                                                    {processingDisputeId === dispute.id ? 'Processing...' : 'Reject'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t pt-3 space-y-2 text-sm">
                                        <div className="break-words">
                                            <span className="font-medium text-gray-700">Question: </span>
                                            <span className="text-gray-900">{dispute.question?.question}</span>
                                        </div>
                                        <div className="break-words">
                                            <span className="font-medium text-gray-700">Correct Answer: </span>
                                            <span className="text-gray-900">{dispute.question?.answer}</span>
                                        </div>
                                        <div className="break-words">
                                            <span className="font-medium text-gray-700">User&apos;s Answer: </span>
                                            <span className="text-gray-900 font-semibold">{dispute.userAnswer}</span>
                                        </div>
                                        <div className="break-words">
                                            <span className="font-medium text-gray-700">Category: </span>
                                            <span className="text-gray-900">{dispute.question?.category?.name}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Value: </span>
                                            <span className="text-gray-900">${dispute.question?.value}</span>
                                        </div>

                                        {dispute.status === 'PENDING' && (
                                            <div className="space-y-2 pt-2 border-t mt-2">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Override Text (optional - defaults to user&apos;s answer)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={disputeOverrideText[dispute.id] || ''}
                                                        onChange={(e) => setDisputeOverrideText(prev => ({
                                                            ...prev,
                                                            [dispute.id]: e.target.value
                                                        }))}
                                                        className="w-full border rounded px-3 py-2 text-gray-900"
                                                        placeholder={dispute.userAnswer}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Admin Comment (optional)
                                                    </label>
                                                    <textarea
                                                        value={disputeAdminComment[dispute.id] || ''}
                                                        onChange={(e) => setDisputeAdminComment(prev => ({
                                                            ...prev,
                                                            [dispute.id]: e.target.value
                                                        }))}
                                                        className="w-full border rounded px-3 py-2 text-gray-900"
                                                        rows={2}
                                                        placeholder="Add a comment..."
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {dispute.status !== 'PENDING' && (
                                            <>
                                                {dispute.adminComment && (
                                                    <div>
                                                        <span className="font-medium text-gray-700">Admin Comment: </span>
                                                        <span className="text-gray-900">{dispute.adminComment}</span>
                                                    </div>
                                                )}
                                                {dispute.override && (
                                                    <div>
                                                        <span className="font-medium text-gray-700">Created Override: </span>
                                                        <span className="text-gray-900">{dispute.override.text}</span>
                                                    </div>
                                                )}
                                                {dispute.resolvedAt && (
                                                    <div>
                                                        <span className="font-medium text-gray-700">Resolved: </span>
                                                        <span className="text-gray-900">{new Date(dispute.resolvedAt).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {disputeTotalPages > 1 && (
                        <div className="mt-6 flex justify-center gap-2">
                            <button
                                onClick={() => setDisputePage(p => Math.max(1, p - 1))}
                                disabled={disputePage === 1}
                                className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 text-gray-900"
                            >
                                Previous
                            </button>
                            <span className="px-4 py-2 text-gray-900">
                                Page {disputePage} of {disputeTotalPages}
                            </span>
                            <button
                                onClick={() => setDisputePage(p => Math.min(disputeTotalPages, p + 1))}
                                disabled={disputePage === disputeTotalPages}
                                className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 text-gray-900"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* DAILY CHALLENGES TAB */}
            {activeTab === 'daily-challenges' && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-semibold text-black mb-2">Daily Challenges</h2>
                            <p className="text-gray-600 text-sm">
                                Monitor and manage daily challenge generation. Challenges are automatically generated via cron job.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                setGeneratingChallenges(true)
                                try {
                                    const response = await fetch('/api/daily-challenge/pre-generate', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ days: 30 })
                                    })
                                    if (response.ok) {
                                        const data = await response.json()
                                        alert(`Generated ${data.created} challenges, ${data.skipped} already existed`)
                                        fetchDailyChallenges()
                                    } else {
                                        alert('Failed to generate challenges')
                                    }
                                } catch (error) {
                                    console.error('Error generating challenges:', error)
                                    alert('Failed to generate challenges')
                                } finally {
                                    setGeneratingChallenges(false)
                                }
                            }}
                            disabled={generatingChallenges}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {generatingChallenges ? 'Generating...' : 'Generate Next 30 Days'}
                        </button>
                    </div>

                    {/* Stats */}
                    {dailyChallengesStats && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                                <div className="text-sm text-blue-600 font-medium mb-1">Coverage</div>
                                <div className="text-2xl font-bold text-blue-900">
                                    {dailyChallengesStats.coverage}%
                                </div>
                                <div className="text-xs text-blue-700 mt-1">
                                    {dailyChallengesStats.daysCovered} / {dailyChallengesStats.daysNeeded} days
                                </div>
                            </div>
                            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                <div className="text-sm text-green-600 font-medium mb-1">Total Completions</div>
                                <div className="text-2xl font-bold text-green-900">
                                    {dailyChallengesStats.totalCompletions}
                                </div>
                                <div className="text-xs text-green-700 mt-1">Last 30 days</div>
                            </div>
                            {dailyChallengesStats.todayChallenge && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                                    <div className="text-sm text-amber-600 font-medium mb-1">Today&apos;s Challenge</div>
                                    <div className="text-lg font-bold text-amber-900">
                                        Active
                                    </div>
                                    <div className="text-xs text-amber-700 mt-1">
                                        {dailyChallengesStats.todayChallenge.completionCount} completions
                                    </div>
                                </div>
                            )}
                            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600 font-medium mb-1">Status</div>
                                <div className="text-lg font-bold text-gray-900">
                                    {dailyChallengesStats.coverage >= 100 ? '✓ Ready' : '⚠️ Low Coverage'}
                                </div>
                                <div className="text-xs text-gray-700 mt-1">
                                    {dailyChallengesStats.coverage >= 100 
                                        ? 'All challenges ready' 
                                        : 'Generate more challenges'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loadingDailyChallenges && dailyChallenges.length === 0 && (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="mt-2 text-gray-600">Loading daily challenges...</p>
                        </div>
                    )}

                    {/* Challenges List */}
                    {dailyChallenges.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Upcoming Challenges (Next 30 Days)</h3>
                            <div className="max-h-96 overflow-y-auto">
                                {dailyChallenges.map((challenge: any) => {
                                    const challengeDate = new Date(challenge.date)
                                    const isToday = challengeDate.toDateString() === new Date().toDateString()
                                    const airDate = challenge.airDate ? new Date(challenge.airDate) : null
                                    
                                    return (
                                        <div
                                            key={challenge.id}
                                            className={`border rounded-lg p-4 ${
                                                isToday ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <span className={`font-semibold ${
                                                            isToday ? 'text-blue-900' : 'text-gray-900'
                                                        }`}>
                                                            {challengeDate.toLocaleDateString('en-US', {
                                                                weekday: 'short',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </span>
                                                        {isToday && (
                                                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                                                                Today
                                                            </span>
                                                        )}
                                                        {airDate && (
                                                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                                                                From: {airDate.toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {challenge.completionCount} completion{challenge.completionCount !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {!loadingDailyChallenges && dailyChallenges.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No daily challenges found. Generate challenges to get started.
                        </div>
                    )}
                </div>
            )}

            {/* GUEST CONFIG TAB */}
            {activeTab === 'guest-config' && (
                <div className="space-y-6">
                    {/* Guest Stats */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-black mb-2">Guest Activity</h2>
                                <p className="text-gray-600 text-sm">
                                    Monitor guest sessions and conversion metrics
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        const response = await fetch('/api/admin/guest-stats')
                                        if (response.ok) {
                                            const data = await response.json()
                                            setGuestStats(data)
                                        }
                                    } catch (error) {
                                        console.error('Error fetching guest stats:', error)
                                    }
                                }}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                            >
                                Refresh Stats
                            </button>
                        </div>

                        {guestStats && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                                    <div className="text-sm text-blue-600 font-medium mb-1">Active Sessions</div>
                                    <div className="text-2xl font-bold text-blue-900">{guestStats.active}</div>
                                </div>
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                                    <div className="text-sm text-amber-600 font-medium mb-1">Unclaimed</div>
                                    <div className="text-2xl font-bold text-amber-900">{guestStats.unclaimed}</div>
                                </div>
                                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                    <div className="text-sm text-green-600 font-medium mb-1">Claimed</div>
                                    <div className="text-2xl font-bold text-green-900">{guestStats.claimed}</div>
                                </div>
                                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 font-medium mb-1">Expired</div>
                                    <div className="text-2xl font-bold text-gray-900">{guestStats.expired}</div>
                                </div>
                            </div>
                        )}

                        {guestStats?.recent && (
                            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                <h3 className="font-semibold text-gray-900 mb-2">Last 24 Hours</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-sm text-gray-600">Unclaimed</div>
                                        <div className="text-xl font-bold text-gray-900">{guestStats.recent.unclaimed}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-600">Claimed</div>
                                        <div className="text-xl font-bold text-gray-900">{guestStats.recent.claimed}</div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <div className="text-sm text-gray-600">Conversion Rate</div>
                                        <div className="text-xl font-bold text-gray-900">
                                            {guestStats.recent.conversionRate.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Guest Config */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-black mb-4">Guest Access Settings</h2>
                        
                        {loadingGuestConfig ? (
                            <div className="text-center py-8">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="mt-2 text-gray-600">Loading configuration...</p>
                            </div>
                        ) : guestConfig ? (
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault()
                                    setSavingGuestConfig(true)
                                    try {
                                        const formData = new FormData(e.currentTarget)
                                        const updates: any = {}
                                        
                                        // Collect form values
                                        updates.randomGameMaxQuestionsBeforeAuth = parseInt(formData.get('randomGameMaxQuestions') as string) || 1
                                        updates.randomQuestionMaxQuestionsBeforeAuth = parseInt(formData.get('randomQuestionMaxQuestions') as string) || 1
                                        updates.dailyChallengeGuestEnabled = formData.get('dailyChallengeGuestEnabled') === 'on'
                                        updates.dailyChallengeGuestAppearsOnLeaderboard = formData.get('dailyChallengeGuestAppearsOnLeaderboard') === 'on'
                                        updates.dailyChallengeMinLookbackDays = parseInt(formData.get('dailyChallengeMinLookbackDays') as string) || 365
                                        updates.timeToAuthenticateMinutes = parseInt(formData.get('timeToAuthenticateMinutes') as string) || 1440

                                        const response = await fetch('/api/admin/guest-config', {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(updates)
                                        })

                                        if (response.ok) {
                                            const updated = await response.json()
                                            setGuestConfig(updated)
                                            alert('Guest configuration updated successfully')
                                        } else {
                                            alert('Failed to update configuration')
                                        }
                                    } catch (error) {
                                        console.error('Error updating guest config:', error)
                                        alert('Failed to update configuration')
                                    } finally {
                                        setSavingGuestConfig(false)
                                    }
                                }}
                                className="space-y-6"
                            >
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Random Game Limits</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Max Questions Before Auth
                                            </label>
                                            <input
                                                type="number"
                                                name="randomGameMaxQuestions"
                                                defaultValue={guestConfig.randomGameMaxQuestionsBeforeAuth}
                                                min="0"
                                                className="w-full p-2 border rounded text-gray-900"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Random Question Limits</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Max Questions Before Auth
                                            </label>
                                            <input
                                                type="number"
                                                name="randomQuestionMaxQuestions"
                                                defaultValue={guestConfig.randomQuestionMaxQuestionsBeforeAuth}
                                                min="0"
                                                className="w-full p-2 border rounded text-gray-900"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Challenge</h3>
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                name="dailyChallengeGuestEnabled"
                                                defaultChecked={guestConfig.dailyChallengeGuestEnabled}
                                                className="rounded border-gray-300 text-blue-600"
                                            />
                                            <span className="text-sm text-gray-700">Allow guests to participate (default: auth required)</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                name="dailyChallengeGuestAppearsOnLeaderboard"
                                                defaultChecked={guestConfig.dailyChallengeGuestAppearsOnLeaderboard}
                                                className="rounded border-gray-300 text-blue-600"
                                            />
                                            <span className="text-sm text-gray-700">Guests appear on leaderboard (only if guest participation enabled)</span>
                                        </label>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                            <label htmlFor="dailyChallengeMinLookbackDays" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                                Minimum Lookback Period (days):
                                            </label>
                                            <input
                                                type="number"
                                                id="dailyChallengeMinLookbackDays"
                                                name="dailyChallengeMinLookbackDays"
                                                min="30"
                                                max="1825"
                                                defaultValue={guestConfig.dailyChallengeMinLookbackDays || 365}
                                                className="w-full sm:w-24 px-2 py-1 border rounded text-gray-900"
                                            />
                                            <span className="text-sm text-gray-600">
                                                (Default: 365 days / 1 year. Daily challenges will use questions from this many days ago up to 3 years ago)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Expiry</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Time to Authenticate (minutes)
                                        </label>
                                        <input
                                            type="number"
                                            name="timeToAuthenticateMinutes"
                                            defaultValue={guestConfig.timeToAuthenticateMinutes}
                                            min="1"
                                            className="w-full p-2 border rounded text-gray-900"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            How long guest sessions remain claimable after creation (default: 1440 = 24 hours)
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={savingGuestConfig}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {savingGuestConfig ? 'Saving...' : 'Save Configuration'}
                                </button>
                            </form>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                Failed to load configuration
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CRON JOBS TAB */}
            {activeTab === 'cron' && (
                <div className="space-y-6">
                    {/* Cron Jobs Overview */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-black mb-2">Cron Jobs Inspector</h2>
                                <p className="text-gray-600 text-sm">
                                    Monitor and manage scheduled cron jobs
                                </p>
                            </div>
                            <button
                                onClick={fetchCronJobs}
                                disabled={loadingCronJobs}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loadingCronJobs ? 'Loading...' : 'Refresh'}
                            </button>
                        </div>

                        {/* Job Status Cards */}
                        {cronJobs && Object.keys(cronJobs).length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                {Object.entries(cronJobs).map(([jobName, job]: [string, any]) => {
                                    const latest = cronLatest[jobName]
                                    const isRunning = latest?.status === 'RUNNING'
                                    const isSuccess = latest?.status === 'SUCCESS'
                                    const isFailed = latest?.status === 'FAILED'
                                    
                                    return (
                                        <div
                                            key={jobName}
                                            className={`border-2 rounded-lg p-4 ${
                                                isRunning
                                                    ? 'border-blue-300 bg-blue-50'
                                                    : isSuccess
                                                    ? 'border-green-300 bg-green-50'
                                                    : isFailed
                                                    ? 'border-red-300 bg-red-50'
                                                    : 'border-gray-300 bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold text-gray-900">{job.name}</h3>
                                                {isRunning && (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 mb-2">{job.description}</p>
                                            <div className="text-xs text-gray-700 mb-2">
                                                <div>Schedule: <code className="bg-gray-200 px-1 rounded">{job.schedule}</code></div>
                                                {latest && (
                                                    <>
                                                        <div className="mt-1">
                                                            Last run: {new Date(latest.startedAt).toLocaleString()}
                                                        </div>
                                                        {latest.durationMs && (
                                                            <div>
                                                                Duration: {(latest.durationMs / 1000).toFixed(2)}s
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {job.endpoint && (
                                                <button
                                                    onClick={() => triggerCronJob(jobName)}
                                                    disabled={triggeringJob === jobName || isRunning}
                                                    className="mt-2 w-full bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {triggeringJob === jobName
                                                        ? 'Triggering...'
                                                        : isRunning
                                                        ? 'Running...'
                                                        : 'Trigger Now'}
                                                </button>
                                            )}
                                            {!job.endpoint && (
                                                <div className="mt-2 text-xs text-gray-500 italic">
                                                    Internal cron (no manual trigger)
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Filter by Job
                                </label>
                                <select
                                    value={cronFilter}
                                    onChange={(e) => setCronFilter(e.target.value as any)}
                                    className="w-full p-2 border rounded text-gray-900"
                                >
                                    <option value="all">All Jobs</option>
                                    <option value="daily-challenge">Daily Challenge</option>
                                    <option value="fetch-questions">Fetch Questions</option>
                                    <option value="fetch-games">Fetch Games</option>
                                    <option value="dispute-summary">Dispute Summary</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Filter by Status
                                </label>
                                <select
                                    value={cronStatusFilter}
                                    onChange={(e) => setCronStatusFilter(e.target.value as any)}
                                    className="w-full p-2 border rounded text-gray-900"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="RUNNING">Running</option>
                                    <option value="SUCCESS">Success</option>
                                    <option value="FAILED">Failed</option>
                                </select>
                            </div>
                        </div>

                        {/* Execution History */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution History</h3>
                            {loadingCronJobs ? (
                                <div className="text-center py-8">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    <p className="mt-2 text-gray-600">Loading executions...</p>
                                </div>
                            ) : cronExecutions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No executions found
                                </div>
                            ) : (
                                <>
                                    {/* Mobile / Tablet Card View */}
                                    <div className="block lg:hidden space-y-3">
                                        {cronExecutions.map((execution: any) => (
                                            <div key={execution.id} className="bg-white border rounded-lg p-4 space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm text-gray-900 break-words">
                                                            {cronJobs?.[execution.jobName]?.name || execution.jobName}
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                                                            execution.status === 'RUNNING'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : execution.status === 'SUCCESS'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                        }`}
                                                    >
                                                        {execution.status}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-600 space-y-1">
                                                    <div>
                                                        <span className="font-medium">Started:</span> {new Date(execution.startedAt).toLocaleString()}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Duration:</span> {execution.durationMs
                                                            ? `${(execution.durationMs / 1000).toFixed(2)}s`
                                                            : execution.status === 'RUNNING'
                                                            ? '...'
                                                            : '-'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Triggered By:</span> {execution.triggeredBy === 'scheduled' ? (
                                                            <span className="text-gray-500">Scheduled</span>
                                                        ) : (
                                                            <span className="text-blue-600">Manual</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {execution.error && (
                                                    <div className="text-red-600 text-xs break-words">
                                                        <span className="font-medium">Error:</span> {execution.error}
                                                    </div>
                                                )}
                                                {execution.result && (
                                                    <details className="text-xs">
                                                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                                                            View Result
                                                        </summary>
                                                        <div className="mt-2">
                                                            {renderCronResult(execution.result, execution.jobName)}
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Desktop Table View */}
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Job Name
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Status
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Started
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Duration
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Triggered By
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Result
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {cronExecutions.map((execution: any) => (
                                                    <tr key={execution.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {cronJobs?.[execution.jobName]?.name || execution.jobName}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span
                                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                                    execution.status === 'RUNNING'
                                                                        ? 'bg-blue-100 text-blue-800'
                                                                        : execution.status === 'SUCCESS'
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-red-100 text-red-800'
                                                                }`}
                                                            >
                                                                {execution.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                            {new Date(execution.startedAt).toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                            {execution.durationMs
                                                                ? `${(execution.durationMs / 1000).toFixed(2)}s`
                                                                : execution.status === 'RUNNING'
                                                                ? '...'
                                                                : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                            {execution.triggeredBy === 'scheduled' ? (
                                                                <span className="text-gray-500">Scheduled</span>
                                                            ) : (
                                                                <span className="text-blue-600">Manual</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-700">
                                                            {execution.error ? (
                                                                <div className="text-red-600 text-xs max-w-xs truncate" title={execution.error}>
                                                                    {execution.error}
                                                                </div>
                                                            ) : execution.result ? (
                                                                <details className="text-xs">
                                                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                                                        View Result
                                                                    </summary>
                                                                    <div className="mt-2 max-w-4xl">
                                                                        {renderCronResult(execution.result, execution.jobName)}
                                                                    </div>
                                                                </details>
                                                            ) : (
                                                                '-'
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-xl font-semibold text-black mb-2">User Management</h2>
                                <p className="text-gray-600 text-sm">
                                    View user activity, manage accounts, and send emails
                                </p>
                            </div>
                            <button
                                onClick={fetchUsers}
                                disabled={loadingUsers}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loadingUsers ? 'Loading...' : 'Refresh'}
                            </button>
                        </div>

                        {/* Search and Sort Controls */}
                        <div className="mb-4 space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search by email, name, or display name..."
                                        value={userSearch}
                                        onChange={(e) => {
                                            setUserSearch(e.target.value)
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                fetchUsers()
                                            }
                                        }}
                                        className="w-full p-2 border rounded text-gray-900"
                                    />
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <div className="relative">
                                        <select
                                            value={userSortBy}
                                            onChange={(e) => {
                                                setUserSortBy(e.target.value as 'lastOnlineAt' | 'createdAt')
                                            }}
                                            className="px-3 py-2 pr-8 border rounded text-gray-900 bg-white text-sm appearance-none cursor-pointer hover:bg-gray-50 transition-colors"
                                        >
                                            <option value="lastOnlineAt">Sort by: Last Online</option>
                                            <option value="createdAt">Sort by: Created Date</option>
                                        </select>
                                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')
                                        }}
                                        className={`px-3 py-2 border rounded text-sm font-medium flex items-center gap-1 transition-colors ${
                                            userSortOrder === 'desc'
                                                ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                                        }`}
                                        title={`Sort ${userSortOrder === 'asc' ? 'Ascending' : 'Descending'} - Click to toggle`}
                                    >
                                        {userSortOrder === 'asc' ? (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                                Asc
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                                Desc
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Error Display */}
                        {usersError && (
                            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                                {usersError}
                            </div>
                        )}

                        {/* Users List */}
                        {loadingUsers ? (
                            <div className="text-center py-8">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="mt-2 text-gray-600">Loading users...</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No users found matching your search.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {users.map((user: any) => {
                                    const lastOnline = user.lastOnlineAt
                                        ? new Date(user.lastOnlineAt).toLocaleString()
                                        : 'Never'
                                    const inProgressCount = user.games?.length || 0

                                    return (
                                        <div key={user.id} className="border rounded-lg p-4 bg-gray-50">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className="font-bold text-gray-900">
                                                            {user.displayName || user.name || 'No name'}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            {user.email}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
                                                        <span>Last Online: {lastOnline}</span>
                                                        {user.lastSeenPath && (
                                                            <>
                                                                <span className="hidden sm:inline">|</span>
                                                                <span>Last Page: <code className="bg-gray-200 px-1 rounded text-xs font-mono">{user.lastSeenPath}</code></span>
                                                            </>
                                                        )}
                                                    </p>
                                                    
                                                    {/* In-Progress Games Section */}
                                                    <div className="mt-3 space-y-2">
                                                        {inProgressCount > 0 ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-semibold text-gray-900">{inProgressCount}</span>
                                                                    <span className="text-sm text-gray-600">
                                                                        {inProgressCount === 1 ? 'in-progress game' : 'in-progress games'}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => navigateToUserGames(user.id)}
                                                                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 whitespace-nowrap font-medium transition-colors"
                                                                        aria-label={`View all games for ${user.displayName || user.email}`}
                                                                    >
                                                                        View All Games →
                                                                    </button>
                                                                </div>
                                                                <details className="group">
                                                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-medium list-none flex items-center gap-1">
                                                                        <span className="group-open:hidden">▶</span>
                                                                        <span className="hidden group-open:inline">▼</span>
                                                                        View In-Progress Games
                                                                    </summary>
                                                                    <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-300">
                                                                        {user.games.map((game: any) => (
                                                                            <div key={game.id} className="pt-2">
                                                                                <div className="text-sm text-gray-700 space-y-1">
                                                                                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                                                                                        <span className="font-medium">Round:</span>
                                                                                        <span>{game.currentRound}</span>
                                                                                        <span className="hidden sm:inline">|</span>
                                                                                        <span className="font-medium">Score:</span>
                                                                                        <span className={game.currentScore >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                                            ${game.currentScore.toLocaleString()}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="text-xs text-gray-500">
                                                                                        Updated: {new Date(game.updatedAt).toLocaleString()}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </details>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm text-gray-400">No in-progress games</span>
                                                                <button
                                                                    onClick={() => navigateToUserGames(user.id)}
                                                                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 whitespace-nowrap font-medium transition-colors"
                                                                    aria-label={`View all games for ${user.displayName || user.email}`}
                                                                >
                                                                    View All Games →
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user)
                                                            setShowDisplayNameModal(true)
                                                            setDisplayNameAction(null)
                                                            setEditDisplayNameValue(user.displayName || '')
                                                        }}
                                                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 whitespace-nowrap"
                                                        aria-label={`Manage display name for ${user.displayName || user.email}`}
                                                    >
                                                        Display Name
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user)
                                                            setShowSendEmailModal(true)
                                                            setEmailSubject('')
                                                            setEmailBody('')
                                                        }}
                                                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 whitespace-nowrap"
                                                        aria-label={`Send email to ${user.displayName || user.email}`}
                                                    >
                                                        Email
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user)
                                                            setShowDeleteUserModal(true)
                                                            setDeleteUserConfirmText('')
                                                        }}
                                                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 whitespace-nowrap"
                                                        aria-label={`Delete account for ${user.displayName || user.email}`}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Display Name Management Modal */}
            {showDisplayNameModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Manage Display Name</h3>
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>User:</strong> {selectedUser.displayName || selectedUser.name || 'No name'} ({selectedUser.email})
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Current Display Name:</strong> {selectedUser.displayName || <span className="text-gray-400">Not set</span>}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {/* Action Selection */}
                            {!displayNameAction && (
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setDisplayNameAction('reset')}
                                        className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-left"
                                    >
                                        <div className="font-semibold">Reset Display Name</div>
                                        <div className="text-sm opacity-90">Generate a new random display name</div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDisplayNameAction('edit')
                                            setEditDisplayNameValue(selectedUser.displayName || '')
                                        }}
                                        className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-left"
                                    >
                                        <div className="font-semibold">Edit Display Name</div>
                                        <div className="text-sm opacity-90">Set a custom display name</div>
                                    </button>
                                </div>
                            )}

                            {/* Reset Confirmation */}
                            {displayNameAction === 'reset' && (
                                <div className="space-y-4">
                                    <p className="text-gray-700">
                                        This will generate a new random display name for this user. The current display name will be replaced.
                                    </p>
                                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setDisplayNameAction(null)
                                            }}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setUpdatingDisplayName(true)
                                                try {
                                                    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ action: 'reset' }),
                                                    })

                                                    if (response.ok) {
                                                        const data = await response.json()
                                                        setMessage(data.message || 'Display name reset successfully')
                                                        setShowDisplayNameModal(false)
                                                        setSelectedUser(null)
                                                        setDisplayNameAction(null)
                                                        fetchUsers()
                                                    } else {
                                                        const error = await response.json()
                                                        alert(error.error || 'Failed to reset display name')
                                                    }
                                                } catch (error) {
                                                    console.error('Error resetting display name:', error)
                                                    alert('Failed to reset display name')
                                                } finally {
                                                    setUpdatingDisplayName(false)
                                                }
                                            }}
                                            disabled={updatingDisplayName}
                                            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {updatingDisplayName ? 'Resetting...' : 'Reset Display Name'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Edit Form */}
                            {displayNameAction === 'edit' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            New Display Name
                                        </label>
                                        <input
                                            type="text"
                                            value={editDisplayNameValue}
                                            onChange={(e) => setEditDisplayNameValue(e.target.value)}
                                            placeholder="Enter display name"
                                            className="w-full p-2 border rounded text-gray-900"
                                            maxLength={50}
                                            autoFocus
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {editDisplayNameValue.length}/50 characters
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setDisplayNameAction(null)
                                                setEditDisplayNameValue(selectedUser.displayName || '')
                                            }}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!editDisplayNameValue.trim()) {
                                                    alert('Display name cannot be empty')
                                                    return
                                                }

                                                setUpdatingDisplayName(true)
                                                try {
                                                    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            action: 'edit',
                                                            displayName: editDisplayNameValue.trim(),
                                                        }),
                                                    })

                                                    if (response.ok) {
                                                        const data = await response.json()
                                                        setMessage(data.message || 'Display name updated successfully')
                                                        setShowDisplayNameModal(false)
                                                        setSelectedUser(null)
                                                        setDisplayNameAction(null)
                                                        setEditDisplayNameValue('')
                                                        fetchUsers()
                                                    } else {
                                                        const error = await response.json()
                                                        alert(error.error || 'Failed to update display name')
                                                    }
                                                } catch (error) {
                                                    console.error('Error updating display name:', error)
                                                    alert('Failed to update display name')
                                                } finally {
                                                    setUpdatingDisplayName(false)
                                                }
                                            }}
                                            disabled={updatingDisplayName || !editDisplayNameValue.trim()}
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {updatingDisplayName ? 'Updating...' : 'Update Display Name'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Close button when no action selected */}
                        {!displayNameAction && (
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => {
                                        setShowDisplayNameModal(false)
                                        setSelectedUser(null)
                                        setDisplayNameAction(null)
                                        setEditDisplayNameValue('')
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete User Confirmation Modal */}
            {showDeleteUserModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-red-600 mb-4">Delete User Account</h3>
                        <p className="text-gray-700 mb-4">
                            You are about to delete the account for <strong>{selectedUser.displayName || selectedUser.name || selectedUser.email}</strong> ({selectedUser.email}).
                        </p>
                        <p className="text-gray-700 mb-4">
                            This will permanently delete all user data from the database, including:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
                            <li>All games and game history</li>
                            <li>User progress and achievements</li>
                            <li>Daily challenge completions</li>
                            <li>Disputes and answer overrides</li>
                        </ul>
                        <p className="text-yellow-600 font-semibold mb-4">
                            Note: This does NOT delete the Clerk account. The user will still be able to sign in, but will need to create a new account.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type the user&apos;s email to confirm deletion:
                            </label>
                            <input
                                type="text"
                                value={deleteUserConfirmText}
                                onChange={(e) => setDeleteUserConfirmText(e.target.value)}
                                placeholder={selectedUser.email}
                                className="w-full p-2 border rounded text-gray-900"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteUserModal(false)
                                    setSelectedUser(null)
                                    setDeleteUserConfirmText('')
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (deleteUserConfirmText !== selectedUser.email) {
                                        alert('Email does not match. Please type the email exactly to confirm deletion.')
                                        return
                                    }

                                    setDeletingUser(true)
                                    try {
                                        const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                                            method: 'DELETE',
                                        })

                                        if (response.ok) {
                                            setMessage(`Successfully deleted user ${selectedUser.email}`)
                                            setShowDeleteUserModal(false)
                                            setSelectedUser(null)
                                            setDeleteUserConfirmText('')
                                            fetchUsers()
                                        } else {
                                            const error = await response.json()
                                            alert(error.error || 'Failed to delete user')
                                        }
                                    } catch (error) {
                                        console.error('Error deleting user:', error)
                                        alert('Failed to delete user')
                                    } finally {
                                        setDeletingUser(false)
                                    }
                                }}
                                disabled={deletingUser || deleteUserConfirmText !== selectedUser.email}
                                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {deletingUser ? 'Deleting...' : 'Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Email Modal */}
            {showSendEmailModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Send Email</h3>
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>To:</strong> {selectedUser.displayName || selectedUser.name || 'No name'} ({selectedUser.email})
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Subject
                                </label>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Email subject"
                                    className="w-full p-2 border rounded text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Message
                                </label>
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder="Email message"
                                    rows={6}
                                    className="w-full p-2 border rounded text-gray-900"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowSendEmailModal(false)
                                    setSelectedUser(null)
                                    setEmailSubject('')
                                    setEmailBody('')
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!emailSubject.trim() || !emailBody.trim()) {
                                        alert('Subject and message are required')
                                        return
                                    }

                                    if (!confirm('Are you sure you want to send this email?')) {
                                        return
                                    }

                                    setSendingEmail(true)
                                    try {
                                        const response = await fetch('/api/admin/users/send-email', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                userId: selectedUser.id,
                                                subject: emailSubject,
                                                body: emailBody,
                                            }),
                                        })

                                        if (response.ok) {
                                            const data = await response.json()
                                            setMessage(data.message || 'Email sent successfully')
                                            setShowSendEmailModal(false)
                                            setSelectedUser(null)
                                            setEmailSubject('')
                                            setEmailBody('')
                                        } else {
                                            const error = await response.json()
                                            alert(error.error || 'Failed to send email')
                                        }
                                    } catch (error) {
                                        console.error('Error sending email:', error)
                                        alert('Failed to send email. Please check your SMTP configuration.')
                                    } finally {
                                        setSendingEmail(false)
                                    }
                                }}
                                disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {sendingEmail ? 'Sending...' : 'Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Game Modal */}
            {editingGame && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Game</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Player: {editingGame.user?.displayName || editingGame.user?.email || 'Unknown'}
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                                <input
                                    type="number"
                                    value={editGameScore}
                                    onChange={(e) => setEditGameScore(e.target.value)}
                                    className="w-full p-2 border rounded text-gray-900"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Round</label>
                                <select
                                    value={editGameRound}
                                    onChange={(e) => setEditGameRound(e.target.value)}
                                    className="w-full p-2 border rounded text-gray-900"
                                >
                                    <option value="SINGLE">Single Jeopardy</option>
                                    <option value="DOUBLE">Double Jeopardy</option>
                                    <option value="FINAL">Final Jeopardy</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={editGameStatus}
                                    onChange={(e) => setEditGameStatus(e.target.value)}
                                    className="w-full p-2 border rounded text-gray-900"
                                >
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="ABANDONED">Abandoned</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                            <button
                                onClick={() => setEditingGame(null)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveGameEdit}
                                disabled={savingGameEdit}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                            >
                                {savingGameEdit ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANAGE TAB */}
            {activeTab === 'manage' && (
                <>
            {/* Calendar View */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-black mb-4">Calendar Coverage</h2>
                {calendarStats && (
                    <>
                    <div className="mb-4">
                        <p className="text-gray-600">
                            Coverage: {calendarStats.totalFilled} / {calendarStats.totalFilled + calendarStats.totalMissing} days 
                            ({(calendarStats.coverage * 100).toFixed(1)}%)
                        </p>
                    </div>
                        <CalendarView 
                            filledDates={calendarStats.filledDates || []}
                            selectedMonth={selectedMonth}
                            onMonthChange={setSelectedMonth}
                            onDateClick={handleCalendarDateClick}
                            selectedDate={selectedCalendarDate}
                        />
                        
                        {/* Date Details Modal/Section */}
                        {selectedCalendarDate && (
                            <div className="mt-6 p-4 bg-gray-50 rounded border overflow-x-auto">
                                <div className="flex justify-between items-start mb-4 gap-2">
                                    <h3 className="font-bold text-lg text-gray-900 break-words flex-1 min-w-0">
                                        {formatDateString(selectedCalendarDate)}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setSelectedCalendarDate(null)
                                            setDateGameData([])
                                        }}
                                        className="text-gray-500 hover:text-gray-700 flex-shrink-0 p-1"
                                        aria-label="Close"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                
                                {loadingDateData ? (
                                    <div className="text-center py-4">
                                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                        <p className="mt-2 text-gray-600">Loading game data...</p>
                                    </div>
                                ) : dateGameData.length > 0 ? (
                                    <div>
                                        <p className="text-sm text-gray-700 mb-4">
                                            Found {dateGameData.length} questions for this date
                                        </p>
                                        {/* Group and display games similar to main games section */}
                                        {(() => {
                                            const dateGroup = dateGroupedGames[selectedCalendarDate]
                                            if (dateGroup) {
                                                return (
                                                    <div className="space-y-4">
                                                        {dateGroup.singleJeopardy.length > 0 && (
                                                            <div>
                                                                <h4 className="font-semibold text-lg mb-2 text-gray-900">Single Jeopardy</h4>
                                                                {dateGroup.singleJeopardy.map((category, idx) => (
                                                                    <CollapsibleCategory key={idx} category={category} />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {dateGroup.doubleJeopardy.length > 0 && (
                                                            <div>
                                                                <h4 className="font-semibold text-lg mb-2 text-gray-900">Double Jeopardy</h4>
                                                                {dateGroup.doubleJeopardy.map((category, idx) => (
                                                                    <CollapsibleCategory key={idx} category={category} />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {dateGroup.finalJeopardy.length > 0 && (
                                                            <div>
                                                                <h4 className="font-semibold text-lg mb-2 text-gray-900">Final Jeopardy</h4>
                                                                {dateGroup.finalJeopardy.map((category, idx) => (
                                                                    <CollapsibleCategory key={idx} category={category} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            }
                                            return <p className="text-gray-600">No grouped data available</p>
                                        })()}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-gray-700 mb-4">No game data found for this date.</p>
                                        <button
                                            onClick={handleFetchMissingDate}
                                            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                                        >
                                            Fetch Game from j-archive
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Manage Existing Games Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-black mb-4">Manage Existing Games</h2>
                <p className="text-gray-600 text-sm mb-4">
                    Filter and manage games that are already in the database. You can select games by date and delete or re-fetch them.
                </p>
                
                {/* Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Date (optional)
                        </label>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="w-full p-2 border rounded text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Date (optional)
                        </label>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="w-full p-2 border rounded text-gray-900"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={loadExistingGames}
                            disabled={searching}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {searching ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Loading...
                                </>
                            ) : (
                                'Load Games'
                            )}
                        </button>
                    </div>
                </div>

                {/* Games List with Selection */}
                {games.length > 0 && (
                    <div className="mt-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <h3 className="font-bold text-lg text-gray-900 break-words">
                                    {games.length} questions across {sortedGameGroups.length} dates
                                </h3>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedExistingDates.size === sortedGameGroups.length && sortedGameGroups.length > 0}
                                        onChange={toggleSelectAllExisting}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700">Select All</span>
                                </label>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                    onClick={openRefetchConfirmation}
                                    disabled={refetching || selectedExistingDates.size === 0}
                                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                                >
                                    {refetching ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Re-fetching...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span>Re-fetch ({selectedExistingDates.size})</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={openDeleteConfirmation}
                                    disabled={deleting || selectedExistingDates.size === 0}
                                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span>Delete ({selectedExistingDates.size})</span>
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[32rem] overflow-y-auto space-y-2 border rounded p-2 bg-gray-50">
                            {sortedGameGroups.map((group) => (
                                <SelectableGameGroup 
                                    key={group.airDate} 
                                    group={group} 
                                    isSelected={selectedExistingDates.has(group.airDate)}
                                    onToggle={() => toggleExistingDateSelection(group.airDate)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {games.length === 0 && !searching && (
                    <div className="text-center py-8 text-gray-500">
                        <p>No games loaded. Use the filters above and click &quot;Load Games&quot; to view existing games.</p>
                    </div>
                )}
            </div>
                </>
            )}

            {/* Calendar Fetch Modal */}
            {showCalendarFetchModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-3xl w-full shadow-xl max-h-[90vh] overflow-y-auto my-auto">
                        <div className="flex justify-between items-start mb-4 gap-2">
                            <h3 className="text-xl font-bold text-gray-900 break-words flex-1 min-w-0">
                                {calendarFetchDate ? `Fetch Game: ${formatDateString(calendarFetchDate)}` : 'Fetch Game'}
                            </h3>
                            <button
                                onClick={closeCalendarFetchModal}
                                className="text-gray-500 hover:text-gray-700 flex-shrink-0 p-1"
                                aria-label="Close"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {calendarFetching ? (
                            <div className="text-center py-12">
                                <svg className="animate-spin h-10 w-10 mx-auto text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="text-gray-600">Fetching game from j-archive...</p>
                            </div>
                        ) : calendarFetchedGame ? (
                            <div>
                                <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                                    <p className="text-green-800 font-medium">Game found!</p>
                                    <p className="text-green-700 text-sm mt-1">
                                        {calendarFetchedGame.title || `Game ${calendarFetchedGame.gameId}`} • 
                                        {calendarFetchedGame.questionCount} questions
                                    </p>
                                </div>
                                
                                <div className="mb-4">
                                    <p className="text-sm text-gray-600 mb-2 flex flex-wrap gap-x-3 gap-y-1">
                                        <span>Single: {calendarFetchedGame.categories.filter((c: Category) => c.round === 'single').length} categories</span>
                                        <span>Double: {calendarFetchedGame.categories.filter((c: Category) => c.round === 'double').length} categories</span>
                                        <span>Final: {calendarFetchedGame.categories.filter((c: Category) => c.round === 'final').length} categories</span>
                                    </p>
                                </div>
                                
                                <div className="max-h-[40vh] overflow-y-auto border rounded p-3 bg-gray-50 mb-4">
                                    {calendarFetchedGame.categories.filter((c: Category) => c.round === 'single').length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="font-semibold text-gray-900 mb-2">Single Jeopardy</h4>
                                            {calendarFetchedGame.categories.filter((c: Category) => c.round === 'single').map((category: Category, idx: number) => (
                                                <CollapsibleCategory key={`single-${idx}`} category={category} />
                                            ))}
                                        </div>
                                    )}
                                    {calendarFetchedGame.categories.filter((c: Category) => c.round === 'double').length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="font-semibold text-gray-900 mb-2">Double Jeopardy</h4>
                                            {calendarFetchedGame.categories.filter((c: Category) => c.round === 'double').map((category: Category, idx: number) => (
                                                <CollapsibleCategory key={`double-${idx}`} category={category} />
                                            ))}
                                        </div>
                                    )}
                                    {calendarFetchedGame.categories.filter((c: Category) => c.round === 'final').length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-gray-900 mb-2">Final Jeopardy</h4>
                                            {calendarFetchedGame.categories.filter((c: Category) => c.round === 'final').map((category: Category, idx: number) => (
                                                <CollapsibleCategory key={`final-${idx}`} category={category} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex flex-col sm:flex-row justify-end gap-3">
                                    <button
                                        onClick={closeCalendarFetchModal}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCalendarPushGame}
                                        disabled={calendarPushing}
                                        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                                    >
                                        {calendarPushing ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Pushing...
                                            </>
                                        ) : (
                                            'Push to Database'
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-red-600">No game found for this date.</p>
                                <p className="text-gray-500 text-sm mt-2">
                                    The game may not be archived yet, or there was an error fetching it.
                                </p>
                                <button
                                    onClick={closeCalendarFetchModal}
                                    className="mt-4 px-4 py-2 text-gray-600 hover:text-gray-800"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Refetch Confirmation Modal */}
            {showRefetchConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-yellow-600 mb-4">Confirm Re-fetch</h3>
                        <p className="text-gray-700 mb-4">
                            You are about to re-fetch <strong>{selectedExistingDates.size} date(s)</strong> from j-archive.
                        </p>
                        <p className="text-gray-700 mb-4">
                            This will delete the existing data for these dates and replace it with fresh data from j-archive.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-end gap-3">
                            <button
                                onClick={() => setShowRefetchConfirm(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRefetchSelected}
                                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 whitespace-nowrap"
                            >
                                Re-fetch Games
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-red-600 mb-4">⚠️ Confirm Deletion</h3>
                        <p className="text-gray-700 mb-4">
                            You are about to delete <strong>{selectedExistingDates.size} date(s)</strong> worth of games 
                            ({getQuestionsForSelectedDates().length} questions total).
                        </p>
                        <p className="text-gray-700 mb-4">
                            This action <strong>cannot be undone</strong>. Type <code className="bg-gray-100 px-2 py-1 rounded font-mono">DELETE</code> below to confirm:
                        </p>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Type DELETE to confirm"
                            className="w-full p-3 border rounded text-gray-900 mb-4 font-mono"
                            autoFocus
                        />
                        <div className="flex flex-col sm:flex-row justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    setDeleteConfirmText('')
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={deleteConfirmText !== 'DELETE' || deleting}
                                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                {deleting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete Games'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
            {/* End Main Content Container */}

            {/* Back to Top Button */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 bg-amber-400 hover:bg-amber-500 text-blue-900 p-3 sm:p-4 rounded-full shadow-2xl ring-4 ring-white/50 transition-all duration-300 z-50 flex items-center justify-center hover:scale-110 touch-manipulation"
                    aria-label="Back to top"
                >
                    <svg 
                        className="w-6 h-6" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2.5} 
                            d="M5 10l7-7m0 0l7 7m-7-7v18" 
                        />
                    </svg>
                </button>
            )}
        </div>
    )
}

function CollapsibleCategory({ category }: { category: Category }) {
    const [isOpen, setIsOpen] = useState(false)
    const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set())

    const toggleAnswer = (idx: number) => {
        setRevealedAnswers(prev => {
            const next = new Set(prev)
            if (next.has(idx)) {
                next.delete(idx)
            } else {
                next.add(idx)
            }
            return next
        })
    }

    return (
        <div className="border rounded">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-3 bg-gray-100 hover:bg-gray-200 flex justify-between items-center text-left gap-2"
            >
                <span className="font-semibold text-gray-900 break-words flex-1 min-w-0">
                    {category.name} ({category.round === 'single' ? 'Single Jeopardy' : category.round === 'double' ? 'Double Jeopardy' : 'Final Jeopardy'}) - {category.questions.length} {category.questions.length === 1 ? 'question' : 'questions'}
                </span>
                <svg
                    className={`w-5 h-5 transform transition-transform text-gray-900 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-4 bg-white">
                    <div className="grid grid-cols-1 gap-2">
                        {category.questions.map((q, idx) => (
                            <div key={idx} className="border-l-4 border-blue-500 pl-3 py-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">${q.value}</p>
                                        <p className="text-sm text-gray-900 mt-1">{q.question}</p>
                                        {revealedAnswers.has(idx) ? (
                                            <div className="mt-2">
                                                <p className="text-sm text-gray-700 italic">Answer: {q.answer}</p>
                                                <button
                                                    onClick={() => toggleAnswer(idx)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                                                >
                                                    Hide Answer
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => toggleAnswer(idx)}
                                                className="text-xs text-blue-600 hover:text-blue-800 mt-2"
                                            >
                                                Reveal Answer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function SelectableGameGroup({ group, isSelected, onToggle }: { 
    group: GameGroup
    isSelected: boolean
    onToggle: () => void 
}) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className={`border rounded ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'bg-white'}`}>
            <div className="flex items-center">
                <div className="p-4 flex items-center">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggle}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 p-4 pl-0 flex justify-between items-center text-left hover:bg-gray-50 gap-2 min-w-0"
                >
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-lg text-gray-900 break-words">
                            {group.airDate === 'unknown' ? 'Unknown Date' : formatDateString(group.airDate)}
                        </div>
                        <div className="text-gray-700 text-sm flex flex-wrap gap-x-2 gap-y-1 mt-1">
                            <span>{group.questionCount} questions</span>
                            <span className="hidden sm:inline">|</span>
                            <span>Single: {group.singleJeopardy.length}</span>
                            <span className="hidden sm:inline">|</span>
                            <span>Double: {group.doubleJeopardy.length}</span>
                            <span className="hidden sm:inline">|</span>
                            <span>Final: {group.finalJeopardy.length}</span>
                        </div>
                    </div>
                    <svg
                        className={`w-5 h-5 transform transition-transform text-gray-700 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
            {isOpen && (
                <div className="p-4 pt-0 bg-white space-y-4 border-t">
                    {group.singleJeopardy.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-lg mb-2 text-gray-900">Single Jeopardy</h4>
                            {group.singleJeopardy.map((category, idx) => (
                                <CollapsibleCategory key={idx} category={category} />
                            ))}
                        </div>
                    )}
                    {group.doubleJeopardy.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-lg mb-2 text-gray-900">Double Jeopardy</h4>
                            {group.doubleJeopardy.map((category, idx) => (
                                <CollapsibleCategory key={idx} category={category} />
                            ))}
                        </div>
                    )}
                    {group.finalJeopardy.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-lg mb-2 text-gray-900">Final Jeopardy</h4>
                            {group.finalJeopardy.map((category, idx) => (
                                <CollapsibleCategory key={idx} category={category} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function CollapsibleGameGroup({ group }: { group: GameGroup }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="border rounded">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 bg-gray-100 hover:bg-gray-200 flex justify-between items-center text-left gap-2"
            >
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg text-gray-900 break-words">
                        {group.airDate === 'unknown' ? 'Unknown Date' : formatDateString(group.airDate)}
                    </div>
                    <div className="text-gray-800 text-sm flex flex-wrap gap-x-2 gap-y-1 mt-1">
                        <span>{group.questionCount} questions</span>
                        <span className="hidden sm:inline">|</span>
                        <span>Single: {group.singleJeopardy.length} categories</span>
                        <span className="hidden sm:inline">|</span>
                        <span>Double: {group.doubleJeopardy.length} categories</span>
                    </div>
                </div>
                <svg
                    className={`w-5 h-5 transform transition-transform text-gray-900 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-4 bg-white space-y-4">
                    {group.singleJeopardy.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-lg mb-2 text-gray-900">Single Jeopardy</h4>
                            {group.singleJeopardy.map((category, idx) => (
                                <CollapsibleCategory key={idx} category={category} />
                            ))}
                        </div>
                    )}
                    {group.doubleJeopardy.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-lg mb-2 text-gray-900">Double Jeopardy</h4>
                            {group.doubleJeopardy.map((category, idx) => (
                                <CollapsibleCategory key={idx} category={category} />
                            ))}
                        </div>
                    )}
                    {group.finalJeopardy.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-lg mb-2 text-gray-900">Final Jeopardy</h4>
                            {group.finalJeopardy.map((category, idx) => (
                                <CollapsibleCategory key={idx} category={category} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function CalendarView({ filledDates, selectedMonth, onMonthChange, onDateClick, selectedDate }: {
    filledDates: string[]
    selectedMonth: string
    onMonthChange: (month: string) => void
    onDateClick: (date: string) => void
    selectedDate: string | null
}) {
    const filledSet = new Set(filledDates)
    const [year, month] = selectedMonth.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    const days = []
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null)
    }
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        days.push(dateStr)
    }

    // Count filled vs missing for this month
    const monthFilled = days.filter(date => date && filledSet.has(date)).length
    const monthTotal = days.filter(date => date).length
    const monthCoverage = monthTotal > 0 ? (monthFilled / monthTotal * 100).toFixed(1) : '0'

    return (
        <div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => onMonthChange(e.target.value)}
                    className="p-2 border rounded text-gray-900 w-full sm:w-auto"
                />
                <div className="text-sm text-gray-700">
                    Month coverage: {monthFilled} / {monthTotal} days ({monthCoverage}%)
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-sm p-2 text-gray-900">
                        {day}
                    </div>
                ))}
                {days.map((date, idx) => {
                    if (!date) {
                        return <div key={idx} className="bg-gray-100 p-2"></div>
                    }
                    
                    const isToday = date === todayStr
                    const isFilled = filledSet.has(date)
                    const isFuture = date > todayStr
                    
                    let bgColor = 'bg-gray-50'
                    let borderColor = 'border-gray-200'
                    let textColor = 'text-gray-900'
                    
                    if (isFuture) {
                        bgColor = 'bg-gray-100'
                        borderColor = 'border-gray-300'
                        textColor = 'text-gray-400'
                    } else if (isFilled) {
                        bgColor = 'bg-green-200'
                        borderColor = 'border-green-500'
                    } else {
                        bgColor = 'bg-red-100'
                        borderColor = 'border-red-300'
                    }
                    
                    const isSelected = date === selectedDate
                    
                    return (
                        <button
                            key={idx}
                            onClick={() => !isFuture && onDateClick(date)}
                            disabled={isFuture}
                            className={`p-1.5 sm:p-2 text-center text-xs sm:text-sm border rounded touch-manipulation ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'} ${bgColor} ${borderColor} ${textColor} ${
                                isToday ? 'ring-2 ring-blue-500' : ''
                            } ${
                                isSelected ? 'ring-2 ring-yellow-400' : ''
                            }`}
                            title={date ? `${date} - ${isFilled ? 'Has data (click to view)' : isFuture ? 'Future date' : 'Missing (click to fetch)'}` : ''}
                        >
                            {parseInt(date.split('-')[2], 10)}
                        </button>
                    )
                })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 sm:gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-200 border-2 border-green-500 rounded flex-shrink-0"></div>
                    <span className="text-gray-900">Has data</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded flex-shrink-0"></div>
                    <span className="text-gray-900">Missing</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded flex-shrink-0"></div>
                    <span className="text-gray-900">Future</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 rounded flex-shrink-0"></div>
                    <span className="text-gray-900">Today</span>
                </div>
            </div>
        </div>
    )
}
