'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'
import { AppUser } from '@/lib/clerk-auth'

interface FriendProfile {
    id: string
    displayName: string | null
    email: string | null
    selectedIcon: string | null
    avatarBackground: string | null
    currentStreak: number
    longestStreak: number
    friendVisibility?: 'FULL_PROFILE' | 'STREAK_ONLY'
}

interface FriendRequestPayload {
    id: string
    fromUserId: string
    toUserId: string
    status: string
    message: string | null
    respondedAt: string | null
    createdAt: string
    updatedAt: string
    fromUser: Pick<FriendProfile, 'id' | 'displayName' | 'email' | 'selectedIcon' | 'avatarBackground'>
    toUser: Pick<FriendProfile, 'id' | 'displayName' | 'email' | 'selectedIcon' | 'avatarBackground'>
}

type FriendActivityType =
    | 'FRIEND_REQUEST_SENT'
    | 'FRIEND_REQUEST_ACCEPTED'
    | 'FRIEND_REQUEST_DECLINED'
    | 'FRIEND_REQUEST_CANCELLED'
    | 'FRIEND_REQUEST_BLOCKED'
    | 'CHALLENGE_CREATED'
    | 'CHALLENGE_ACCEPTED'
    | 'CHALLENGE_DECLINED'
    | 'CHALLENGE_COMPLETED'
    | 'CHALLENGE_CANCELLED'

interface ChallengeRecord {
    id: string
    challengerUserId: string
    opponentUserId: string
    mode: string
    targetValue: number | null
    status: string
    message: string | null
    expiresAt: string
    winnerUserId: string | null
    challengerScore: number | null
    opponentScore: number | null
    challengerGameId?: string | null
    opponentGameId?: string | null
    boardCategoryId?: string | null
    boardCategoryIds?: string[]
    boardCategories?: Array<{ id: string; name: string }>
    challenger: Pick<FriendProfile, 'id' | 'displayName' | 'selectedIcon' | 'avatarBackground'>
    opponent: Pick<FriendProfile, 'id' | 'displayName' | 'selectedIcon' | 'avatarBackground'>
    winner: Pick<FriendProfile, 'id' | 'displayName' | 'selectedIcon' | 'avatarBackground'> | null
}

interface CategorySearchResult {
    id: string
    name: string
    _count?: {
        questions?: number
    }
}

interface ChallengeComposerDraft {
    opponentId: string
    mode: 'PRACTICE' | 'GAME'
    categorySelection: 'RANDOM' | 'CHOSEN'
    categoryCount: number
    categoryChoices: Array<{ id: string; name: string }>
}

interface FriendActivity {
    id: string
    actorUserId: string
    relatedUserId: string | null
    activityType: FriendActivityType
    metadata: Record<string, unknown> | null
    createdAt: string
    actorUser: Pick<FriendProfile, 'id' | 'displayName' | 'selectedIcon' | 'avatarBackground'> | null
    relatedUser: Pick<FriendProfile, 'id' | 'displayName' | 'selectedIcon' | 'avatarBackground'> | null
}

interface FriendDataPayload {
    friends: FriendProfile[]
    incomingRequests: FriendRequestPayload[]
    outgoingRequests: FriendRequestPayload[]
    settings: {
        friendVisibility: 'FULL_PROFILE' | 'STREAK_ONLY'
        allowFriendRequests: boolean
    }
    blockedUsers: FriendProfile[]
}

interface FriendsClientProps {
    user: AppUser
}

interface FriendSettings {
    friendVisibility: 'FULL_PROFILE' | 'STREAK_ONLY'
    allowFriendRequests: boolean
}

interface ChallengeCompletionInput {
    challengerScore: string
    opponentScore: string
}

interface ActivityCopy {
    headline: string
    detail?: string
    icon: string
    tone: 'default' | 'success' | 'warning' | 'info'
}

interface ActiveChallengeConflict {
    id: string
    mode: string
    status: string
    challengerUserId: string
    opponentUserId: string
    challengerDisplayName: string | null
    opponentDisplayName: string | null
}

interface ApiErrorPayload {
    error?: string
    code?: string
    details?: {
        activeChallenge?: ActiveChallengeConflict
    }
}

interface EndChallengeModalState {
    mode: 'replace-existing' | 'end-active'
    challengeId: string
    title: string
    message: string
    confirmLabel: string
}

interface ChallengeComposerAlert {
    tone: 'warning' | 'error'
    message: string
}

type FriendSection = 'friends' | 'requests' | 'challenges' | 'activity' | 'compare' | 'settings'

type ActivityFilter = 'all' | FriendActivityType

const ACTIVITY_FILTER_OPTIONS: { value: ActivityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'FRIEND_REQUEST_SENT', label: 'Requests sent' },
    { value: 'FRIEND_REQUEST_ACCEPTED', label: 'Requests accepted' },
    { value: 'FRIEND_REQUEST_DECLINED', label: 'Requests declined' },
    { value: 'FRIEND_REQUEST_BLOCKED', label: 'Requests blocked' },
    { value: 'CHALLENGE_CREATED', label: 'Challenges created' },
    { value: 'CHALLENGE_ACCEPTED', label: 'Challenges accepted' },
    { value: 'CHALLENGE_DECLINED', label: 'Challenges declined' },
    { value: 'CHALLENGE_CANCELLED', label: 'Challenges cancelled' },
    { value: 'CHALLENGE_COMPLETED', label: 'Challenges completed' },
]

function toInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Number.isInteger(value) ? value : Math.trunc(value)
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10)
        return Number.isNaN(parsed) ? null : parsed
    }
    return null
}

function formatUserLabel(user: { displayName: string | null; email?: string | null } | null | undefined): string {
    return user?.displayName || user?.email || 'someone'
}

function formatModeLabel(mode: string | undefined): string {
    if (!mode) {
        return 'challenge'
    }
    return mode.toLowerCase() === 'game' ? 'game' : 'practice'
}

function formatChallengeLine(
    challenge: {
        challengerUserId: string
        opponentUserId: string
        challengerScore: number | null
        opponentScore: number | null
        winnerUserId: string | null
    },
    metadata: Record<string, unknown> | null,
): string | null {
    const challengerScore = toInteger(metadata?.challengerScore ?? challenge.challengerScore)
    const opponentScore = toInteger(metadata?.opponentScore ?? challenge.opponentScore)
    if (challengerScore === null || opponentScore === null) {
        return null
    }
    if (challenge.winnerUserId === null) {
        return `Tied at ${challengerScore}–${opponentScore}`
    }
    if (challenge.winnerUserId === challenge.challengerUserId) {
        return `Challenger won ${challengerScore}–${opponentScore}`
    }
    return `Opponent won ${challengerScore}–${opponentScore}`
}

function formatActivity(activity: FriendActivity): ActivityCopy {
    const actorName = formatUserLabel(activity.actorUser)
    const relatedName = formatUserLabel(activity.relatedUser)
    const targetValue = toInteger(activity.metadata?.targetValue)
    const targetText = targetValue ? ` (target: ${targetValue})` : ''

    switch (activity.activityType) {
        case 'FRIEND_REQUEST_SENT':
            return {
                icon: '📥',
                tone: 'info',
                headline: `${actorName} sent a friend request to ${relatedName}`,
            }
        case 'FRIEND_REQUEST_ACCEPTED':
            return {
                icon: '✅',
                tone: 'success',
                headline: `${actorName} accepted ${relatedName}'s friend request`,
            }
        case 'FRIEND_REQUEST_DECLINED':
            return {
                icon: '🚫',
                tone: 'warning',
                headline: `${actorName} declined ${relatedName}'s friend request`,
            }
        case 'FRIEND_REQUEST_CANCELLED':
            return {
                icon: '↩️',
                tone: 'default',
                headline: `${actorName} cancelled a friend request${relatedName ? ` sent to ${relatedName}` : ''}`,
            }
        case 'FRIEND_REQUEST_BLOCKED':
            return {
                icon: '⛔',
                tone: 'warning',
                headline: `${actorName} blocked ${relatedName}`,
            }
        case 'CHALLENGE_CREATED': {
            const mode = formatModeLabel(typeof activity.metadata?.mode === 'string' ? activity.metadata.mode : undefined)
            return {
                icon: '⚔️',
                tone: 'default',
                headline: `${actorName} created a ${mode} challenge${targetText} against ${relatedName}`,
            }
        }
        case 'CHALLENGE_ACCEPTED':
            return {
                icon: '👍',
                tone: 'success',
                headline: `${actorName} accepted a challenge from ${relatedName}`,
            }
        case 'CHALLENGE_DECLINED':
            return {
                icon: '🙅',
                tone: 'warning',
                headline: `${actorName} declined a challenge from ${relatedName}`,
            }
        case 'CHALLENGE_CANCELLED':
            return {
                icon: '🧹',
                tone: 'default',
                headline: `${actorName} cancelled a pending challenge${relatedName ? ` against ${relatedName}` : ''}`,
            }
        case 'CHALLENGE_COMPLETED': {
            const challengerScore = toInteger(activity.metadata?.challengerScore)
            const opponentScore = toInteger(activity.metadata?.opponentScore)
            if (challengerScore === null || opponentScore === null) {
                return {
                    icon: '🏁',
                    tone: 'info',
                    headline: `${actorName} completed a challenge`,
                }
            }
            const challengerUserId = typeof activity.metadata?.challengeChallengerUserId === 'string'
                ? activity.metadata.challengeChallengerUserId
                : activity.actorUserId
            const opponentUserId = typeof activity.metadata?.challengeOpponentUserId === 'string'
                ? activity.metadata.challengeOpponentUserId
                : activity.relatedUserId
            const winner = challengerScore === opponentScore ? null : challengerScore > opponentScore
                ? challengerUserId
                : opponentUserId
            const challengerName = challengerUserId === activity.actorUserId
                ? actorName
                : challengerUserId === activity.relatedUserId
                    ? relatedName
                    : 'challenger'
            const opponentName = opponentUserId === activity.actorUserId
                ? actorName
                : opponentUserId === activity.relatedUserId
                    ? relatedName
                    : 'opponent'
            const resultLine =
                winner === null
                    ? `Tied at ${challengerScore}–${opponentScore}`
                    : `${winner === challengerUserId ? challengerName : opponentName} won ${challengerScore}–${opponentScore}`
            return {
                icon: '🏁',
                tone: 'success',
                headline: `${actorName} logged a challenge result`,
                detail: resultLine,
            }
        }
        default:
            return {
                icon: '🔔',
                tone: 'default',
                headline: `${actorName} had social activity${relatedName ? ` with ${relatedName}` : ''}`,
                detail: `Type: ${activity.activityType}`,
            }
    }
}

function getActivityToneClass(tone: ActivityCopy['tone']) {
    switch (tone) {
        case 'success':
            return 'bg-green-50 border-green-200 text-green-700'
        case 'warning':
            return 'bg-amber-50 border-amber-200 text-amber-700'
        case 'info':
            return 'bg-blue-50 border-blue-200 text-blue-700'
        default:
            return 'bg-gray-50 border-gray-200 text-gray-700'
    }
}

function formatActivityTime(createdAt: string): string {
    const value = new Date(createdAt)
    const now = new Date()
    const deltaMinutes = Math.round((now.getTime() - value.getTime()) / 60000)
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

    if (Number.isNaN(deltaMinutes)) {
        return value.toLocaleString()
    }

    if (deltaMinutes === 0) {
        return 'just now'
    }

    if (Math.abs(deltaMinutes) < 60) {
        return formatter.format(-deltaMinutes, 'minute')
    }

    const deltaHours = Math.round(deltaMinutes / 60)
    if (Math.abs(deltaHours) < 24) {
        return formatter.format(-deltaHours, 'hour')
    }

    const deltaDays = Math.round(deltaHours / 24)
    if (Math.abs(deltaDays) < 30) {
        return formatter.format(-deltaDays, 'day')
    }

    const deltaMonths = Math.round(deltaDays / 30)
    if (Math.abs(deltaMonths) < 24) {
        return formatter.format(-deltaMonths, 'month')
    }

    return value.toLocaleString()
}

export default function FriendsClient({ user }: FriendsClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [friends, setFriends] = useState<FriendProfile[]>([])
    const [incomingRequests, setIncomingRequests] = useState<FriendRequestPayload[]>([])
    const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestPayload[]>([])
    const [challenges, setChallenges] = useState<ChallengeRecord[]>([])
    const [activities, setActivities] = useState<FriendActivity[]>([])
    const [challengeScores, setChallengeScores] = useState<Record<string, ChallengeCompletionInput>>({})
    const [submittingChallengeId, setSubmittingChallengeId] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [targetInput, setTargetInput] = useState('')
    const [requestMessage, setRequestMessage] = useState('')
    const [blockedUsers, setBlockedUsers] = useState<FriendProfile[]>([])
    const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
    const [activeSection, setActiveSection] = useState<FriendSection>('friends')
    const [friendSettings, setFriendSettings] = useState<FriendSettings>({
        friendVisibility: 'FULL_PROFILE',
        allowFriendRequests: true,
    })
    const [selectedFriendId, setSelectedFriendId] = useState('')
    const [challengeComposer, setChallengeComposer] = useState<ChallengeComposerDraft | null>(null)
    const [categorySearchQuery, setCategorySearchQuery] = useState('')
    const [categorySearchResults, setCategorySearchResults] = useState<CategorySearchResult[]>([])
    const [categorySearchLoading, setCategorySearchLoading] = useState(false)
    const [creatingChallenge, setCreatingChallenge] = useState(false)
    const [comparison, setComparison] = useState<{
        viewer: FriendProfile
        friend: FriendProfile
        comparison: { currentStreakDelta: number; longestStreakDelta: number }
    } | null>(null)
    const [comparisonLoading, setComparisonLoading] = useState(false)
    const [activeChallengeConflict, setActiveChallengeConflict] = useState<ActiveChallengeConflict | null>(null)
    const [challengeComposerAlert, setChallengeComposerAlert] = useState<ChallengeComposerAlert | null>(null)
    const [endChallengeModal, setEndChallengeModal] = useState<EndChallengeModalState | null>(null)
    const [processingEndChallenge, setProcessingEndChallenge] = useState(false)
    const refreshInFlightRef = useRef(false)
    const appliedQueryTabRef = useRef<string | null>(null)

    const goToChallengesTab = useCallback(() => {
        appliedQueryTabRef.current = 'challenges'
        setActiveSection('challenges')
        router.replace('/friends?tab=challenges')
    }, [router])

    const loadFriendData = useCallback(async (
        activityTypeFilter: ActivityFilter = activityFilter,
        options: { silent?: boolean } = {},
    ) => {
        if (refreshInFlightRef.current) {
            return
        }
        refreshInFlightRef.current = true
        const silent = options.silent === true
        setErrorMessage('')
        if (!silent) {
            setIsLoading(true)
        }

        try {
            const activityParams = new URLSearchParams({ limit: '30' })
            if (activityTypeFilter !== 'all') {
                activityParams.set('activityType', activityTypeFilter)
            }

            const [friendsResponse, challengeResponse, activityResponse] = await Promise.all([
                fetch('/api/friends?status=pending'),
                fetch('/api/challenges/friends?status=all&includeExpired=true'),
                fetch(`/api/friends/activity?${activityParams.toString()}`),
            ])

            if (!friendsResponse.ok || !challengeResponse.ok || !activityResponse.ok) {
                throw new Error('Unable to load friend data')
            }

            const friendsPayload = await friendsResponse.json() as FriendDataPayload
            const challengePayload = await challengeResponse.json() as { challenges: ChallengeRecord[] }
            const activityPayload = await activityResponse.json() as { activities: FriendActivity[] }
            const fetchedChallenges = challengePayload.challenges || []
            const incomingPending = (friendsPayload.incomingRequests || []).filter(
                (request) => request.status === 'PENDING',
            )
            const outgoingPending = (friendsPayload.outgoingRequests || []).filter(
                (request) => request.status === 'PENDING',
            )

            setFriends(friendsPayload.friends || [])
            setIncomingRequests(incomingPending)
            setOutgoingRequests(outgoingPending)
            setFriendSettings(friendsPayload.settings || {
                friendVisibility: 'FULL_PROFILE',
                allowFriendRequests: true,
            })
            setBlockedUsers(friendsPayload.blockedUsers || [])
            setChallenges(fetchedChallenges)
            setActivities(activityPayload.activities || [])

            // Clear stale challenge score entry state for removed/finished challenges.
            setChallengeScores((previous) => {
                const challengeIds = new Set(fetchedChallenges.map((challenge) => challenge.id))
                const next: Record<string, ChallengeCompletionInput> = {}
                Object.entries(previous).forEach(([challengeId, value]) => {
                    if (challengeIds.has(challengeId)) {
                        next[challengeId] = value
                    }
                })
                return next
            })
        } catch {
            if (!silent) {
                setErrorMessage('Failed to load friend data')
            }
        } finally {
            if (!silent) {
                setIsLoading(false)
            }
            refreshInFlightRef.current = false
        }
    }, [activityFilter])

    const loadComparison = async (friendId: string) => {
        if (!friendId) return
        setErrorMessage('')
        setComparisonLoading(true)
        try {
            const response = await fetch(`/api/friends/streak-comparison?friendId=${friendId}`)
            if (!response.ok) {
                const body = await response.json()
                throw new Error(body?.error || 'Unable to compare with this friend')
            }
            const payload = await response.json()
            setComparison(payload)
        } catch (error) {
            const typed = error as Error
            setErrorMessage(typed.message)
            setComparison(null)
        } finally {
            setComparisonLoading(false)
        }
    }

    useEffect(() => {
        void loadFriendData(activityFilter)
    }, [activityFilter, loadFriendData])

    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (!tabParam || appliedQueryTabRef.current === tabParam) {
            return
        }

        const section = tabParam as FriendSection
        if (
            section === 'friends'
            || section === 'requests'
            || section === 'challenges'
            || section === 'activity'
            || section === 'compare'
            || section === 'settings'
        ) {
            appliedQueryTabRef.current = tabParam
            setActiveSection(section)
        }
    }, [searchParams])

    useEffect(() => {
        const pollId = window.setInterval(() => {
            void loadFriendData(activityFilter, { silent: true })
        }, 5000)

        const handleVisibilityRefresh = () => {
            if (!document.hidden) {
                void loadFriendData(activityFilter, { silent: true })
            }
        }

        window.addEventListener('focus', handleVisibilityRefresh)
        document.addEventListener('visibilitychange', handleVisibilityRefresh)

        return () => {
            window.clearInterval(pollId)
            window.removeEventListener('focus', handleVisibilityRefresh)
            document.removeEventListener('visibilitychange', handleVisibilityRefresh)
        }
    }, [activityFilter, loadFriendData])

    useEffect(() => {
        if (!selectedFriendId || friends.length === 0) {
            return
        }
        void loadComparison(selectedFriendId)
    }, [selectedFriendId, friends])

    useEffect(() => {
        if (challengeComposer?.categorySelection !== 'CHOSEN') {
            setCategorySearchResults([])
            setCategorySearchLoading(false)
            return
        }

        const query = categorySearchQuery.trim()
        if (query.length < 2) {
            setCategorySearchResults([])
            setCategorySearchLoading(false)
            return
        }

        let cancelled = false
        const timer = window.setTimeout(async () => {
            setCategorySearchLoading(true)
            try {
                const response = await fetch(`/api/categories/search?q=${encodeURIComponent(query)}&page=1`)
                if (!response.ok) {
                    throw new Error('Unable to search categories')
                }
                const payload = await response.json() as CategorySearchResult[]
                if (!cancelled) {
                    setCategorySearchResults(payload)
                }
            } catch {
                if (!cancelled) {
                    setCategorySearchResults([])
                }
            } finally {
                if (!cancelled) {
                    setCategorySearchLoading(false)
                }
            }
        }, 250)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [categorySearchQuery, challengeComposer?.categorySelection])

    const sendFriendRequest = async () => {
        if (!targetInput.trim()) return

        const response = await fetch('/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target: targetInput.trim(),
                message: requestMessage.trim() || undefined,
            }),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to send friend request')
        }

        setTargetInput('')
        setRequestMessage('')
        await loadFriendData()
    }

    const respondToRequest = async (requestId: string, action: 'accept' | 'decline' | 'cancel') => {
        const response = await fetch('/api/friends/response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, action }),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to update request')
        }

        await loadFriendData()
    }

    const openChallengeComposer = (opponentId?: string) => {
        const nextOpponentId = opponentId || friends[0]?.id || ''
        setChallengeComposer({
            opponentId: nextOpponentId,
            mode: 'GAME',
            categorySelection: 'RANDOM',
            categoryCount: 1,
            categoryChoices: [],
        })
        setActiveChallengeConflict(null)
        setChallengeComposerAlert(null)
        setCategorySearchQuery('')
        setCategorySearchResults([])
    }

    const closeChallengeComposer = () => {
        setChallengeComposer(null)
        setActiveChallengeConflict(null)
        setChallengeComposerAlert(null)
        setCategorySearchQuery('')
        setCategorySearchResults([])
        setCategorySearchLoading(false)
        setCreatingChallenge(false)
    }

    const setChallengeOpponent = (opponentId: string) => {
        setChallengeComposer((previous) => {
            if (!previous) {
                return previous
            }
            return {
                ...previous,
                opponentId,
            }
        })
        setActiveChallengeConflict(null)
        setChallengeComposerAlert(null)
    }

    const setChallengeComposerSelection = (selection: 'RANDOM' | 'CHOSEN') => {
        setChallengeComposer((previous) => {
            if (!previous) {
                return previous
            }
            return {
                ...previous,
                categorySelection: selection,
            }
        })
    }

    const setChallengeCategoryCount = (nextCount: number) => {
        setChallengeComposer((previous) => {
            if (!previous) {
                return previous
            }
            const bounded = Math.min(Math.max(nextCount, 1), 6)
            return {
                ...previous,
                categoryCount: bounded,
                categoryChoices: previous.categoryChoices.slice(0, bounded),
            }
        })
    }

    const toggleChallengeCategoryChoice = (category: { id: string; name: string }) => {
        setChallengeComposer((previous) => {
            if (!previous || previous.categorySelection !== 'CHOSEN') {
                return previous
            }

            const exists = previous.categoryChoices.some((choice) => choice.id === category.id)
            if (exists) {
                return {
                    ...previous,
                    categoryChoices: previous.categoryChoices.filter((choice) => choice.id !== category.id),
                }
            }

            if (previous.categoryChoices.length >= previous.categoryCount) {
                return previous
            }

            return {
                ...previous,
                categoryChoices: [...previous.categoryChoices, { id: category.id, name: category.name }],
            }
        })
    }

    const submitChallengeComposer = async () => {
        if (!challengeComposer || creatingChallenge) {
            return
        }

        const { opponentId, mode, categorySelection, categoryCount, categoryChoices } = challengeComposer
        setChallengeComposerAlert(null)
        if (!opponentId) {
            setChallengeComposerAlert({
                tone: 'warning',
                message: 'Select a friend to challenge before creating.',
            })
            return
        }
        if (categorySelection === 'CHOSEN' && categoryChoices.length !== categoryCount) {
            setChallengeComposerAlert({
                tone: 'warning',
                message: `Select exactly ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}.`,
            })
            return
        }

        setCreatingChallenge(true)
        try {
            const response = await fetch('/api/challenges/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    opponentId,
                    mode,
                    categorySelection,
                    categoryCount,
                    categoryIds: categorySelection === 'CHOSEN' ? categoryChoices.map((choice) => choice.id) : undefined,
                }),
            })

            if (!response.ok) {
                const payload = await response.json() as ApiErrorPayload
                if (payload?.code === 'ACTIVE_CHALLENGE_EXISTS' && payload?.details?.activeChallenge) {
                    setActiveChallengeConflict(payload.details.activeChallenge)
                    setChallengeComposerAlert(null)
                    return
                }
                if (payload?.code === 'ACTIVE_CHALLENGE_EXISTS') {
                    setChallengeComposerAlert({
                        tone: 'warning',
                        message: payload.error || 'An active challenge already exists between these users.',
                    })
                    return
                }
                setChallengeComposerAlert({
                    tone: 'error',
                    message: payload?.error || 'Unable to create challenge.',
                })
                return
            }

            setActiveChallengeConflict(null)
            setChallengeComposerAlert(null)
            closeChallengeComposer()
            await loadFriendData()
        } catch {
            setChallengeComposerAlert({
                tone: 'error',
                message: 'Unable to create challenge. Please try again.',
            })
        } finally {
            setCreatingChallenge(false)
        }
    }

    const endExistingAndRetryChallenge = async (challengeId: string) => {
        if (!challengeComposer || creatingChallenge) {
            return
        }

        setChallengeComposerAlert(null)
        setCreatingChallenge(true)
        try {
            const endResponse = await fetch('/api/challenges/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'end', challengeId }),
            })

            if (!endResponse.ok) {
                const payload = await endResponse.json() as ApiErrorPayload
                setChallengeComposerAlert({
                    tone: 'error',
                    message: payload?.error || 'Unable to end existing challenge.',
                })
                return
            }

            const { opponentId, mode, categorySelection, categoryCount, categoryChoices } = challengeComposer
            const createResponse = await fetch('/api/challenges/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    opponentId,
                    mode,
                    categorySelection,
                    categoryCount,
                    categoryIds: categorySelection === 'CHOSEN' ? categoryChoices.map((choice) => choice.id) : undefined,
                }),
            })

            if (!createResponse.ok) {
                const payload = await createResponse.json() as ApiErrorPayload
                if (payload?.code === 'ACTIVE_CHALLENGE_EXISTS' && payload?.details?.activeChallenge) {
                    setActiveChallengeConflict(payload.details.activeChallenge)
                    setChallengeComposerAlert(null)
                    return
                }
                if (payload?.code === 'ACTIVE_CHALLENGE_EXISTS') {
                    setChallengeComposerAlert({
                        tone: 'warning',
                        message: payload.error || 'An active challenge already exists between these users.',
                    })
                    return
                }
                setChallengeComposerAlert({
                    tone: 'error',
                    message: payload?.error || 'Unable to create challenge.',
                })
                return
            }

            setActiveChallengeConflict(null)
            setChallengeComposerAlert(null)
            closeChallengeComposer()
            await loadFriendData()
        } catch {
            setChallengeComposerAlert({
                tone: 'error',
                message: 'Unable to replace the existing challenge right now.',
            })
        } finally {
            setCreatingChallenge(false)
        }
    }

    const openReplaceChallengeModal = () => {
        if (!activeChallengeConflict) {
            return
        }

        const challengerName = activeChallengeConflict.challengerDisplayName || 'Challenger'
        const opponentName = activeChallengeConflict.opponentDisplayName || 'Opponent'
        setEndChallengeModal({
            mode: 'replace-existing',
            challengeId: activeChallengeConflict.id,
            title: 'Replace existing challenge?',
            message: `This will end the current ${activeChallengeConflict.mode.toLowerCase()} challenge (${challengerName} vs ${opponentName}) and create your new challenge settings.`,
            confirmLabel: 'Yes, replace challenge',
        })
    }

    const openEndChallengeModal = (challenge: ChallengeRecord) => {
        const challengerName = formatUserLabel(challenge.challenger)
        const opponentName = formatUserLabel(challenge.opponent)
        setEndChallengeModal({
            mode: 'end-active',
            challengeId: challenge.id,
            title: 'End active challenge?',
            message: `This will cancel the active challenge between ${challengerName} and ${opponentName}. This cannot be undone.`,
            confirmLabel: 'Yes, end challenge',
        })
    }

    const closeEndChallengeModal = () => {
        if (processingEndChallenge) {
            return
        }
        setEndChallengeModal(null)
    }

    const confirmEndChallengeAction = async () => {
        if (!endChallengeModal || processingEndChallenge) {
            return
        }

        setProcessingEndChallenge(true)
        try {
            if (endChallengeModal.mode === 'replace-existing') {
                await endExistingAndRetryChallenge(endChallengeModal.challengeId)
            } else {
                await updateChallenge(endChallengeModal.challengeId, 'end')
            }
            goToChallengesTab()
            setEndChallengeModal(null)
        } catch (error) {
            markError(error)
        } finally {
            setProcessingEndChallenge(false)
        }
    }

    const updateFriendSettings = async (updates: Partial<FriendSettings>) => {
        const response = await fetch('/api/friends/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to update friend settings')
        }

        const payload = await response.json()
        if (payload?.settings) {
            setFriendSettings(payload.settings)
        }
    }

    const handleVisibilityChange = async (friendVisibility: FriendSettings['friendVisibility']) => {
        await updateFriendSettings({ friendVisibility })
        await loadFriendData()
    }

    const handleAllowRequestsChange = async (allowFriendRequests: boolean) => {
        setFriendSettings((previous) => ({ ...previous, allowFriendRequests }))
        await updateFriendSettings({ allowFriendRequests })
    }

    const setFriendBlock = async (blockedUserId: string, action: 'block' | 'unblock') => {
        const response = await fetch('/api/friends/blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blockedUserId, action }),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to update blocked users')
        }

        const payload = await response.json()
        setBlockedUsers(payload.blockedUsers || [])
        await loadFriendData()
    }

    const setRequestBlock = async (request: FriendRequestPayload, action: 'block' | 'unblock' = 'block') => {
        const blockedUserId = request.fromUserId === user.id ? request.toUserId : request.fromUserId
        if (!blockedUserId) {
            setErrorMessage('Could not identify user to block')
            return
        }

        await setFriendBlock(blockedUserId, action)
    }

    const updateChallenge = async (challengeId: string, action: 'accept' | 'decline' | 'cancel' | 'end') => {
        const response = await fetch('/api/challenges/friends', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, challengeId }),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to update challenge')
        }

        const payload = await response.json() as { launchGameId?: string }
        if (action === 'accept' && payload.launchGameId) {
            router.push(`/game/${payload.launchGameId}`)
            return
        }

        await loadFriendData()
    }

    const launchChallengeGame = async (challengeId: string) => {
        const response = await fetch('/api/challenges/friends', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'launch', challengeId }),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to launch challenge game')
        }

        const payload = await response.json() as { gameId?: string }
        if (!payload?.gameId) {
            throw new Error('Challenge game ID not found')
        }

        router.push(`/game/${payload.gameId}`)
    }

    const setChallengeScore = (challengeId: string, role: 'challenger' | 'opponent', value: string) => {
        setChallengeScores((previous) => ({
            ...previous,
            [challengeId]: {
                challengerScore: role === 'challenger' ? value : previous[challengeId]?.challengerScore || '',
                opponentScore: role === 'opponent' ? value : previous[challengeId]?.opponentScore || '',
            },
        }))
    }

    const completeChallenge = async (challengeId: string, challenge: ChallengeRecord) => {
        if (submittingChallengeId) {
            return
        }

        const draft = challengeScores[challengeId] ?? {
            challengerScore: challenge.challengerScore?.toString() || '',
            opponentScore: challenge.opponentScore?.toString() || '',
        }
        const challengerScore = toInteger(draft.challengerScore)
        const opponentScore = toInteger(draft.opponentScore)

        if (challengerScore === null || opponentScore === null) {
            setErrorMessage('Please enter numeric scores for both players')
            setTimeout(() => setErrorMessage(''), 3500)
            return
        }

        if (challengerScore < 0 || opponentScore < 0) {
            setErrorMessage('Scores cannot be negative')
            setTimeout(() => setErrorMessage(''), 3500)
            return
        }

        setSubmittingChallengeId(challengeId)
        try {
            const response = await fetch('/api/challenges/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'complete',
                    challengeId,
                    challengerScore,
                    opponentScore,
                }),
            })

            if (!response.ok) {
                const payload = await response.json()
                throw new Error(payload?.error || 'Unable to complete challenge')
            }

            setChallengeScores((previous) => ({
                ...previous,
                [challengeId]: {
                    challengerScore: challengerScore.toString(),
                    opponentScore: opponentScore.toString(),
                },
            }))
            await loadFriendData()
        } finally {
            setSubmittingChallengeId(null)
        }
    }

    const removeFriend = async (friendId: string) => {
        if (!window.confirm('Remove this friend?')) {
            return
        }

        const response = await fetch('/api/friends/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId }),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to remove friend')
        }

        if (selectedFriendId === friendId) {
            setSelectedFriendId('')
            setComparison(null)
        }

        await loadFriendData()
    }

    const markError = (error: unknown) => {
        if (error instanceof Error) {
            setErrorMessage(error.message)
        } else {
            setErrorMessage('Unexpected error')
        }
        setTimeout(() => setErrorMessage(''), 3500)
    }

    const pendingChallengeCount = useMemo(
        () => challenges.filter((challenge) => challenge.status === 'PENDING').length,
        [challenges],
    )
    const challengeComposerOpponent = useMemo(
        () => friends.find((friend) => friend.id === challengeComposer?.opponentId) || null,
        [challengeComposer?.opponentId, friends],
    )

    const blockedUserIds = blockedUsers.map((blockedUser) => blockedUser.id)
    const isBlockedById = (otherUserId: string) => blockedUserIds.includes(otherUserId)

    const friendlyName = (request: FriendRequestPayload) =>
        request.fromUserId === user.id
            ? request.toUser.displayName || request.toUser.email || 'Unknown'
            : request.fromUser.displayName || request.fromUser.email || 'Unknown'

    const isChallengeExpired = (challenge: ChallengeRecord) => challenge.status === 'EXPIRED' || new Date(challenge.expiresAt) <= new Date()

    const challengeExpiresSoon = (challenge: ChallengeRecord) => {
        if (challenge.status !== 'PENDING') return false
        const msRemaining = new Date(challenge.expiresAt).getTime() - new Date().getTime()
        return msRemaining > 0 && msRemaining <= 24 * 60 * 60 * 1000
    }

    const winnerCopy = (challenge: ChallengeRecord) => {
        if (challenge.status !== 'COMPLETED') return null

        const scoreLine = formatChallengeLine(challenge, {})
        if (challenge.winnerUserId === user.id) {
            return {
                title: 'You won this challenge 🎉',
                detail: scoreLine ?? undefined,
            }
        }
        if (challenge.winnerUserId === null) {
            return {
                title: 'This challenge was a tie',
                detail: scoreLine ?? undefined,
            }
        }
        return {
            title: `${challenge.winner?.displayName || 'A friend'} won this challenge`,
            detail: scoreLine ?? undefined,
        }
    }

    const draftChallengeResult = (challenge: ChallengeRecord, draft: ChallengeCompletionInput) => {
        const challengerScore = toInteger(draft.challengerScore)
        const opponentScore = toInteger(draft.opponentScore)
        if (challengerScore === null || opponentScore === null) {
            return null
        }

        if (challengerScore === opponentScore) {
            return `Projected result: tied at ${challengerScore}–${opponentScore}`
        }

        const challengerName = formatUserLabel(challenge.challenger)
        const opponentName = formatUserLabel(challenge.opponent)
        return challengerScore > opponentScore
            ? `Projected result: ${challengerName} leads ${challengerScore}–${opponentScore}`
            : `Projected result: ${opponentName} leads ${challengerScore}–${opponentScore}`
    }

    const challengeStatusBadge = (challenge: ChallengeRecord) => {
        switch (challenge.status) {
            case 'COMPLETED':
                return 'bg-green-100 text-green-800'
            case 'ACCEPTED':
                return 'bg-blue-100 text-blue-800'
            case 'DECLINED':
            case 'CANCELLED':
                return 'bg-gray-100 text-gray-800'
            case 'EXPIRED':
                return 'bg-amber-100 text-amber-800'
            case 'PENDING':
            default:
                return isChallengeExpired(challenge) ? 'bg-red-100 text-red-800' : 'bg-sky-100 text-sky-800'
        }
    }

    const comparisonStatusLabel = (friendId: string) => {
        if (selectedFriendId !== friendId) {
            return 'Ready to compare'
        }

        if (comparisonLoading) {
            return 'Loading comparison...'
        }

        if (!comparison || comparison.friend.id !== friendId) {
            return 'Comparison active'
        }

        const delta = comparison.comparison.currentStreakDelta
        if (delta === 0) {
            return 'Current streaks tied'
        }
        return delta > 0
            ? `You lead by ${delta}`
            : `You trail by ${Math.abs(delta)}`
    }

    if (isLoading) {
        return <div className="container mx-auto px-4 py-8">Loading friends...</div>
    }

    return (
        <div className="friends-hub container mx-auto px-4 py-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Friends Hub</h1>
                <p className="text-gray-600">Connect, challenge, and compare with your friends.</p>
            </div>

            {errorMessage && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {errorMessage}
                </div>
            )}

            <div className="flex flex-wrap gap-2 mb-6">
                {(['friends', 'requests', 'challenges', 'activity', 'compare', 'settings'] as const).map((section) => (
                    <button
                        key={section}
                        type="button"
                        onClick={() => setActiveSection(section)}
                        className={`rounded border px-4 py-2 text-sm font-medium ${
                            activeSection === section
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-200'
                        }`}
                    >
                        {section === 'friends'
                            ? 'Friends'
                            : section === 'requests'
                                ? 'Requests'
                                : section === 'challenges'
                                    ? `Challenges (${pendingChallengeCount})`
                                    : section === 'activity'
                                        ? 'Activity'
                                        : section === 'settings'
                                            ? 'Privacy & Blocking'
                                            : 'Compare'}
                    </button>
                ))}
            </div>

            {activeSection === 'requests' && (
                <section className="card p-5">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Friend</h2>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                        <label className="grid gap-1.5">
                            <span className="text-sm font-medium text-slate-800">Friend Search</span>
                            <input
                                value={targetInput}
                                onChange={(event) => setTargetInput(event.target.value)}
                                className="form-input bg-white text-gray-900 placeholder:text-gray-500"
                                placeholder="Search by username, email, or id"
                            />
                        </label>
                        <label className="grid gap-1.5">
                            <span className="text-sm font-medium text-slate-800">
                                Optional Message <span className="text-slate-600 font-normal">(optional)</span>
                            </span>
                            <input
                                value={requestMessage}
                                onChange={(event) => setRequestMessage(event.target.value)}
                                className="form-input bg-white text-gray-900 placeholder:text-gray-500"
                                placeholder="Optional message"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => void sendFriendRequest().catch(markError)}
                            className="btn-primary btn-sm md:col-span-2"
                        >
                            Send Request
                        </button>
                    </div>
                </section>
            )}

            {activeSection === 'friends' && (
                <section className="card p-5 mt-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Friends ({friends.length})</h2>
                    {friends.length === 0 ? (
                        <p className="text-gray-600 text-sm">No friends yet. Send a request to get started.</p>
                    ) : (
                        <div className="grid gap-3">
                            {friends.map((friend) => (
                                <div key={friend.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-100 p-3">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            displayName={friend.displayName || friend.email || ''}
                                            selectedIcon={friend.selectedIcon}
                                            avatarBackground={friend.avatarBackground}
                                            size="md"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">
                                                {friend.displayName || friend.email || 'Unknown'}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Current streak: {friend.currentStreak} · Best streak: {friend.longestStreak}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {comparisonStatusLabel(friend.id)}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            className="btn-primary btn-sm"
                                            onClick={() => {
                                                setActiveSection('challenges')
                                                openChallengeComposer(friend.id)
                                            }}
                                        >
                                            Challenge
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-outline btn-sm"
                                            onClick={() => {
                                                setSelectedFriendId(friend.id)
                                                setActiveSection('compare')
                                                void loadComparison(friend.id)
                                            }}
                                        >
                                            Compare
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-outline btn-sm"
                                            disabled={isBlockedById(friend.id)}
                                            onClick={() => void setFriendBlock(friend.id, isBlockedById(friend.id) ? 'unblock' : 'block').catch(markError)}
                                        >
                                            {isBlockedById(friend.id) ? 'Unblock' : 'Block'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-outline btn-sm ml-3"
                                            onClick={() => void removeFriend(friend.id).catch(markError)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {activeSection === 'requests' && (
                <section className="card p-5 mt-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Requests</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <h3 className="font-medium text-sm text-gray-700 mb-2">Incoming</h3>
                            {incomingRequests.length === 0 ? (
                                <p className="text-sm text-gray-500">No incoming requests.</p>
                            ) : (
                                incomingRequests.map((request) => (
                                    <div key={request.id} className="rounded border border-gray-100 p-3 mb-3 last:mb-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <UserAvatar
                                                displayName={request.fromUser.displayName || 'Unknown'}
                                                selectedIcon={request.fromUser.selectedIcon}
                                                avatarBackground={request.fromUser.avatarBackground}
                                                size="sm"
                                            />
                                            <span className="text-sm font-medium text-gray-900">{friendlyName(request)} wants to connect</span>
                                        </div>
                                        {request.message && (
                                            <p className="text-sm text-gray-700">“{request.message}”</p>
                                        )}
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                type="button"
                                                className="btn-outline btn-sm"
                                                onClick={() => void setRequestBlock(request, 'block').catch(markError)}
                                            >
                                                Block {friendlyName(request)}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-primary btn-sm"
                                                onClick={() => void respondToRequest(request.id, 'accept').catch(markError)}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-outline btn-sm"
                                                onClick={() => void respondToRequest(request.id, 'decline').catch(markError)}
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div>
                            <h3 className="font-medium text-sm text-gray-700 mb-2">Outgoing</h3>
                            {outgoingRequests.length === 0 ? (
                                <p className="text-sm text-gray-500">No outgoing requests.</p>
                            ) : (
                                outgoingRequests.map((request) => (
                                    <div key={request.id} className="rounded border border-gray-100 p-3 mb-3 last:mb-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <UserAvatar
                                                displayName={request.toUser.displayName || 'Unknown'}
                                                selectedIcon={request.toUser.selectedIcon}
                                                avatarBackground={request.toUser.avatarBackground}
                                                size="sm"
                                            />
                                            <span className="text-sm font-medium text-gray-900">
                                                Sent to {request.toUser.displayName || request.toUser.email || 'Unknown'}
                                            </span>
                                        </div>
                                        {request.message && (
                                            <p className="text-sm text-gray-700">“{request.message}”</p>
                                        )}
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                type="button"
                                                className="btn-outline btn-sm"
                                                onClick={() => void setRequestBlock(request, 'block').catch(markError)}
                                            >
                                                Block {friendlyName(request)}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-outline btn-sm"
                                                onClick={() => void respondToRequest(request.id, 'cancel').catch(markError)}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
            )}

            {activeSection === 'challenges' && (
                <section className="card p-5 mt-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Challenges</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Start a live round challenge with one focused setup flow.
                            </p>
                        </div>
                        {friends.length > 0 ? (
                            <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => openChallengeComposer()}
                            >
                                New Challenge
                            </button>
                        ) : null}
                    </div>
                    {friends.length === 0 ? (
                        <p className="text-sm text-gray-600">
                            Add friends to start creating challenges.
                        </p>
                    ) : (
                        <>
                            {challenges.length === 0 ? (
                                <p className="text-sm text-gray-600">No challenges yet.</p>
                            ) : (
                                <div className="grid gap-3">
                                    {challenges.map((challenge) => {
                                        const draft = challengeScores[challenge.id] ?? {
                                            challengerScore: challenge.challengerScore?.toString() || '',
                                            opponentScore: challenge.opponentScore?.toString() || '',
                                        }
                                        const expiresSoon = challengeExpiresSoon(challenge)
                                        const winner = winnerCopy(challenge)
                                        const challengerName = formatUserLabel(challenge.challenger)
                                        const opponentName = formatUserLabel(challenge.opponent)
                                        const boardCategories = challenge.boardCategories || []
                                        return (
                                            <div key={challenge.id} className="rounded border border-gray-100 p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {challenge.challenger.displayName || 'Unknown'} vs {challenge.opponent.displayName || 'Unknown'}
                                                        </div>
                                                        <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${challengeStatusBadge(challenge)}`}>
                                                            {challenge.mode} · {challenge.status}
                                                        </div>
                                                        {challenge.targetValue !== null ? (
                                                            <div className="text-sm text-gray-500 mt-1">
                                                                Target: {challenge.targetValue}
                                                            </div>
                                                        ) : null}
                                                        {challenge.status === 'PENDING' && expiresSoon ? (
                                                            <div className="text-xs text-amber-600 mt-1">
                                                                Expires soon
                                                            </div>
                                                        ) : null}
                                                        {winner ? (
                                                            <div className="mt-2">
                                                                <p className="text-sm font-semibold text-gray-900">{winner.title}</p>
                                                                {winner.detail ? (
                                                                    <p className="text-sm text-gray-600">
                                                                        {winner.detail}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                        {challenge.mode === 'GAME' && boardCategories.length > 0 ? (
                                                            <div className="mt-2 text-xs text-gray-600">
                                                                Board: {boardCategories.map((category) => category.name).join(' • ')}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {challenge.status === 'PENDING' && challenge.opponentUserId === user.id ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="btn-primary btn-sm"
                                                                    onClick={() => void updateChallenge(challenge.id, 'accept').catch(markError)}
                                                                >
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn-outline btn-sm"
                                                                    onClick={() => void updateChallenge(challenge.id, 'decline').catch(markError)}
                                                                >
                                                                    Decline
                                                                </button>
                                                            </>
                                                        ) : null}
                                                        {(challenge.status === 'PENDING' || challenge.status === 'ACCEPTED') ? (
                                                            <button
                                                                type="button"
                                                                className="btn-outline btn-sm"
                                                                onClick={() => openEndChallengeModal(challenge)}
                                                            >
                                                                End
                                                            </button>
                                                        ) : null}
                                                        {challenge.challengerUserId === user.id && challenge.status === 'PENDING' ? (
                                                            <button
                                                                type="button"
                                                                className="btn-outline btn-sm"
                                                                onClick={() => void updateChallenge(challenge.id, 'cancel').catch(markError)}
                                                            >
                                                                Cancel
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                {(challenge.status === 'ACCEPTED' || challenge.status === 'PENDING') && challenge.mode !== 'GAME' && (
                                                    <div className="mt-3 rounded border border-gray-100 p-2 md:p-3">
                                                        <p className="text-sm text-gray-700 mb-2">
                                                            {challenge.status === 'ACCEPTED'
                                                                ? 'Log your final scores to complete this challenge'
                                    : 'Scores can be entered once the challenge is accepted'}
                                                        </p>
                                                        {challenge.status === 'ACCEPTED' ? (
                                                            <div className="grid gap-2 md:grid-cols-2 md:items-end">
                                                                <label className="grid gap-1 text-sm">
                                                                    <span className="text-gray-600">
                                                                        {challenge.challengerUserId === user.id ? 'Your score' : challengerName} score
                                                                    </span>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={100000}
                                                                        inputMode="numeric"
                                                                        value={draft.challengerScore}
                                                                        onChange={(event) => setChallengeScore(challenge.id, 'challenger', event.target.value)}
                                                                        className="form-input"
                                                                    />
                                                                </label>
                                                                <label className="grid gap-1 text-sm">
                                                                    <span className="text-gray-600">
                                                                        {challenge.opponentUserId === user.id ? 'Your score' : opponentName} score
                                                                    </span>
                                                                    <div className="flex gap-2">
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            max={100000}
                                                                            inputMode="numeric"
                                                                            value={draft.opponentScore}
                                                                            onChange={(event) => setChallengeScore(challenge.id, 'opponent', event.target.value)}
                                                                            className="form-input"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            className="btn-primary btn-sm whitespace-nowrap"
                                                                            onClick={() => void completeChallenge(challenge.id, challenge).catch(markError)}
                                                                            disabled={submittingChallengeId === challenge.id}
                                                                        >
                                                                            {submittingChallengeId === challenge.id ? 'Saving...' : 'Submit'}
                                                                        </button>
                                                                    </div>
                                                                </label>
                                                                {draftChallengeResult(challenge, draft) ? (
                                                                    <p className="md:col-span-2 text-xs text-gray-600">
                                                                        {draftChallengeResult(challenge, draft)}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                        {challenge.status === 'PENDING' && isChallengeExpired(challenge) ? (
                                                            <p className="mt-2 text-sm text-red-600">This challenge expired.</p>
                                                        ) : null}
                                                    </div>
                                                )}
                                                {challenge.mode === 'GAME' && (challenge.status === 'ACCEPTED' || challenge.status === 'COMPLETED') && (
                                                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-xs text-blue-700">
                                                        <span className="font-semibold text-blue-900">Live round</span>
                                                        <span>•</span>
                                                        <span>Auto-scored</span>
                                                        <span>•</span>
                                                        <span>
                                                            {challengerName}: {challenge.challengerScore === null ? 'Not finished' : `${challenge.challengerScore} pts`}
                                                        </span>
                                                        <span>•</span>
                                                        <span>
                                                            {opponentName}: {challenge.opponentScore === null ? 'Not finished' : `${challenge.opponentScore} pts`}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="btn-primary btn-sm ml-auto"
                                                            onClick={() => void launchChallengeGame(challenge.id).catch(markError)}
                                                        >
                                                            {challenge.status === 'COMPLETED' ? 'Review Challenge Round' : 'Play Challenge Round'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </section>
            )}

            {activeSection === 'activity' && (
                <section className="card p-5 mt-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Friend Activity Feed</h2>
                    <div className="mb-4 flex flex-wrap gap-2">
                        {ACTIVITY_FILTER_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`rounded px-3 py-1.5 text-xs font-medium border ${
                                    activityFilter === option.value
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-200'
                                }`}
                                onClick={() => {
                                    if (activityFilter === option.value) {
                                        return
                                    }
                                    setActivityFilter(option.value)
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    {activities.length === 0 ? (
                        <p className="text-sm text-gray-600">No recent activity.</p>
                    ) : (
                        <div className="grid gap-2">
                            {activities.map((activity) => {
                                const copy = formatActivity(activity)
                                const actorName = formatUserLabel(activity.actorUser)
                                const relatedName = formatUserLabel(activity.relatedUser)
                                return (
                                    <div key={activity.id} className={`rounded border p-3 ${getActivityToneClass(copy.tone)}`}>
                                        <div className="flex items-start gap-3">
                                            <div className="text-xl leading-none mt-0.5" aria-hidden>
                                                {copy.icon}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm text-gray-900">
                                                    {copy.headline}
                                                </div>
                                                {activity.actorUser ? (
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                                        <UserAvatar
                                                            displayName={actorName}
                                                            selectedIcon={activity.actorUser.selectedIcon}
                                                            avatarBackground={activity.actorUser.avatarBackground}
                                                            size="sm"
                                                            className="w-6 h-6 text-xs"
                                                        />
                                                        <span>{actorName}</span>
                                                        {activity.relatedUser ? (
                                                            <>
                                                                <span>→</span>
                                                                <UserAvatar
                                                                    displayName={relatedName}
                                                                    selectedIcon={activity.relatedUser.selectedIcon}
                                                                    avatarBackground={activity.relatedUser.avatarBackground}
                                                                    size="sm"
                                                                    className="w-6 h-6 text-xs"
                                                                />
                                                                <span>{relatedName}</span>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                {copy.detail ? <div className="text-xs text-gray-600 mt-1">{copy.detail}</div> : null}
                                                <div className="text-xs text-gray-500 mt-1">{formatActivityTime(activity.createdAt)}</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>
            )}

            {activeSection === 'compare' && (
                <section className="card p-5 mt-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Streak Comparison</h2>
                    <div className="mb-4">
                        <label className="text-sm text-gray-700 block mb-2">Pick a friend</label>
                        <select
                            value={selectedFriendId}
                            onChange={(event) => setSelectedFriendId(event.target.value)}
                            className="form-input w-full"
                        >
                            <option value="">Choose friend</option>
                            {friends.map((friend) => (
                                <option key={`compare-${friend.id}`} value={friend.id}>
                                    {friend.displayName || friend.email}
                                </option>
                            ))}
                        </select>
                    </div>
                    {comparisonLoading && selectedFriendId ? (
                        <p className="text-sm text-gray-600">Loading comparison...</p>
                    ) : comparison ? (
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded border border-gray-100 p-3">
                                <div className="font-medium text-gray-900">{comparison.viewer.displayName}</div>
                                <div className="text-sm text-gray-600">
                                    Current streak: {comparison.viewer.currentStreak}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Best streak: {comparison.viewer.longestStreak}
                                </div>
                            </div>
                            <div className="rounded border border-gray-100 p-3">
                                <div className="font-medium text-gray-900">{comparison.friend.displayName}</div>
                                <div className="text-sm text-gray-600">
                                    Current streak: {comparison.friend.currentStreak}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Best streak: {comparison.friend.longestStreak}
                                </div>
                            </div>
                            <div className="rounded border border-gray-100 p-3 md:col-span-2">
                                <p className="text-sm text-gray-700">
                                    {comparison.comparison.currentStreakDelta === 0
                                        ? 'Current streaks are tied.'
                                        : comparison.comparison.currentStreakDelta > 0
                                            ? `You are ahead by ${comparison.comparison.currentStreakDelta} streaks.`
                                            : `You are behind by ${Math.abs(comparison.comparison.currentStreakDelta)} streaks.`}
                                </p>
                                <p className="text-sm text-gray-700 mt-1">
                                    {comparison.comparison.longestStreakDelta === 0
                                        ? 'Best streaks are tied.'
                                        : comparison.comparison.longestStreakDelta > 0
                                            ? `Your best streak is better by ${comparison.comparison.longestStreakDelta}.`
                                            : `Their best streak is better by ${Math.abs(comparison.comparison.longestStreakDelta)}.`}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-600">Select a friend to compare streaks.</p>
                    )}
                </section>
            )}

            {activeSection === 'settings' && (
                <section className="card p-5 mt-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy & Block Settings</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2">
                            <span className="text-sm font-medium text-gray-700">Who can see your profile in friend discovery?</span>
                            <select
                                value={friendSettings.friendVisibility}
                                onChange={(event) =>
                                    void handleVisibilityChange(event.target.value as FriendSettings['friendVisibility']).catch(markError)
                                }
                                className="form-input"
                            >
                                <option value="FULL_PROFILE">Full profile</option>
                                <option value="STREAK_ONLY">Streaks only</option>
                            </select>
                        </label>
                        <label className="grid gap-2">
                            <span className="text-sm font-medium text-gray-700">Incoming friend requests</span>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={friendSettings.allowFriendRequests}
                                    onChange={(event) => void handleAllowRequestsChange(event.target.checked).catch(markError)}
                                />
                                <span className="text-sm text-gray-600">Allow requests</span>
                            </label>
                        </label>
                    </div>

                    <h3 className="mt-6 mb-3 font-medium text-gray-900">Blocked Users</h3>
                    {blockedUsers.length === 0 ? (
                        <p className="text-sm text-gray-600">You have not blocked any users.</p>
                    ) : (
                        <div className="grid gap-2">
                            {blockedUsers.map((blockedUser) => (
                                <div
                                    key={blockedUser.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-100 p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            displayName={blockedUser.displayName || blockedUser.email || ''}
                                            selectedIcon={blockedUser.selectedIcon}
                                            avatarBackground={blockedUser.avatarBackground}
                                            size="sm"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">
                                                {blockedUser.displayName || blockedUser.email || 'Unknown'}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                {blockedUser.email}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-outline btn-sm"
                                        onClick={() => void setFriendBlock(blockedUser.id, 'unblock').catch(markError)}
                                    >
                                        Unblock
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {challengeComposer ? (
                <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/45"
                        onClick={closeChallengeComposer}
                        disabled={creatingChallenge}
                        aria-label="Close challenge composer"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="challenge-composer-title"
                        className="relative w-full max-w-2xl rounded-xl border border-blue-200 bg-white p-5 shadow-xl"
                    >
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 id="challenge-composer-title" className="text-lg font-semibold text-gray-900">
                                    Create Challenge
                                </h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    Build a live Single Jeopardy challenge with automatic scoring.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={closeChallengeComposer}
                                disabled={creatingChallenge}
                            >
                                Cancel
                            </button>
                        </div>

                        {challengeComposerAlert ? (
                            <div
                                role="alert"
                                className={`mb-4 rounded border p-3 text-sm ${
                                    challengeComposerAlert.tone === 'warning'
                                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                                        : 'border-red-200 bg-red-50 text-red-700'
                                }`}
                            >
                                {challengeComposerAlert.message}
                            </div>
                        ) : null}

                        {activeChallengeConflict ? (
                            <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
                                <p className="text-sm font-medium text-amber-900">
                                    Active challenge exists with {challengeComposerOpponent?.displayName || challengeComposerOpponent?.email || 'this friend'}.
                                </p>
                                <p className="mt-1 text-xs text-amber-800">
                                    Status: {activeChallengeConflict.mode} · {activeChallengeConflict.status}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className="btn-primary btn-sm"
                                        onClick={openReplaceChallengeModal}
                                        disabled={creatingChallenge}
                                    >
                                        {creatingChallenge ? 'Ending...' : 'Replace Existing'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-outline btn-sm"
                                        onClick={() => setActiveChallengeConflict(null)}
                                        disabled={creatingChallenge}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        <div className="grid gap-4">
                            <label className="grid gap-1 text-sm">
                                <span className="font-medium text-gray-800">Friend</span>
                                <select
                                    className="form-input bg-white"
                                    value={challengeComposer.opponentId}
                                    onChange={(event) => setChallengeOpponent(event.target.value)}
                                    disabled={creatingChallenge}
                                >
                                    <option value="">Select friend</option>
                                    {friends.map((friend) => (
                                        <option key={`composer-opponent-${friend.id}`} value={friend.id}>
                                            {friend.displayName || friend.email || 'Unknown'}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="rounded border border-blue-100 bg-blue-50/70 p-3">
                                <p className="text-sm font-medium text-blue-900">Board Setup</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-blue-900">Category source</span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                                                    challengeComposer.categorySelection === 'RANDOM'
                                                        ? 'border-blue-600 bg-blue-600 text-white'
                                                        : 'border-blue-200 bg-white text-blue-800'
                                                }`}
                                                onClick={() => setChallengeComposerSelection('RANDOM')}
                                                disabled={creatingChallenge}
                                            >
                                                Random
                                            </button>
                                            <button
                                                type="button"
                                                className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                                                    challengeComposer.categorySelection === 'CHOSEN'
                                                        ? 'border-blue-600 bg-blue-600 text-white'
                                                        : 'border-blue-200 bg-white text-blue-800'
                                                }`}
                                                onClick={() => setChallengeComposerSelection('CHOSEN')}
                                                disabled={creatingChallenge}
                                            >
                                                Chosen
                                            </button>
                                        </div>
                                    </label>
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-blue-900">Categories in round</span>
                                        <select
                                            className="form-input bg-white"
                                            value={challengeComposer.categoryCount}
                                            onChange={(event) => setChallengeCategoryCount(Number.parseInt(event.target.value, 10))}
                                            disabled={creatingChallenge}
                                        >
                                            {[1, 2, 3, 4, 5, 6].map((count) => (
                                                <option key={`challenge-category-count-${count}`} value={count}>
                                                    {count}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>

                            {challengeComposer.categorySelection === 'CHOSEN' ? (
                                <div className="rounded border border-blue-200 bg-white p-3">
                                    <label className="grid gap-1 text-sm">
                                        <span className="text-blue-900">
                                            Choose {challengeComposer.categoryCount} categories
                                        </span>
                                        <input
                                            value={categorySearchQuery}
                                            onChange={(event) => setCategorySearchQuery(event.target.value)}
                                            className="form-input bg-white text-gray-900"
                                            placeholder="Search categories (2+ characters)"
                                            disabled={creatingChallenge}
                                        />
                                    </label>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {challengeComposer.categoryChoices.length === 0 ? (
                                            <span className="text-xs text-blue-700">
                                                No categories selected yet.
                                            </span>
                                        ) : challengeComposer.categoryChoices.map((choice) => (
                                            <button
                                                key={`challenge-choice-${choice.id}`}
                                                type="button"
                                                className="rounded-full border border-blue-300 bg-blue-100 px-2 py-1 text-xs text-blue-900"
                                                onClick={() => toggleChallengeCategoryChoice(choice)}
                                                disabled={creatingChallenge}
                                            >
                                                {choice.name} ×
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-2 max-h-48 overflow-auto rounded border border-blue-100">
                                        {categorySearchLoading ? (
                                            <p className="px-3 py-2 text-xs text-blue-700">Searching categories...</p>
                                        ) : categorySearchResults.length === 0 ? (
                                            <p className="px-3 py-2 text-xs text-blue-700">
                                                {categorySearchQuery.trim().length < 2
                                                    ? 'Type at least 2 characters to search.'
                                                    : 'No categories found.'}
                                            </p>
                                        ) : (
                                            categorySearchResults.map((category) => {
                                                const selected = challengeComposer.categoryChoices.some((choice) => choice.id === category.id)
                                                const atLimit = challengeComposer.categoryChoices.length >= challengeComposer.categoryCount
                                                return (
                                                    <button
                                                        key={`challenge-search-result-${category.id}`}
                                                        type="button"
                                                        className="flex w-full items-center justify-between border-b border-blue-100 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
                                                        onClick={() => toggleChallengeCategoryChoice(category)}
                                                        disabled={creatingChallenge || (!selected && atLimit)}
                                                    >
                                                        <span className="font-medium text-blue-900">{category.name}</span>
                                                        <span className="text-blue-700">
                                                            {selected ? 'Selected' : category._count?.questions ? `${category._count.questions} clues` : 'Add'}
                                                        </span>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-600">
                                    Random mode will auto-select {challengeComposer.categoryCount} categories for this round.
                                </p>
                            )}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-gray-600">
                                The challenge appears immediately in the Challenges tab for both players.
                            </p>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => void submitChallengeComposer()}
                                disabled={
                                    creatingChallenge
                                    || !challengeComposer.opponentId
                                    || (
                                        challengeComposer.categorySelection === 'CHOSEN'
                                        && challengeComposer.categoryChoices.length !== challengeComposer.categoryCount
                                    )
                                }
                            >
                                {creatingChallenge ? 'Creating...' : 'Create Challenge'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {endChallengeModal ? (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/45"
                        onClick={closeEndChallengeModal}
                        aria-label="Close confirmation dialog"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="end-challenge-modal-title"
                        className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl"
                    >
                        <h3 id="end-challenge-modal-title" className="text-lg font-semibold text-gray-900">
                            {endChallengeModal.title}
                        </h3>
                        <p className="mt-2 text-sm text-gray-600">
                            {endChallengeModal.message}
                        </p>
                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={closeEndChallengeModal}
                                disabled={processingEndChallenge}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => void confirmEndChallengeAction()}
                                disabled={processingEndChallenge}
                            >
                                {processingEndChallenge ? 'Working...' : endChallengeModal.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
