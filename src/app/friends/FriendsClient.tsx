'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'
import { AppUser } from '@/lib/clerk-auth'
import {
    getCustomCategorySelectionKey,
    type CustomCategorySelection,
} from '@/lib/custom-category-selections'
import {
    clampFriendChallengeCategoryCount,
    FriendChallengeCategorySelection,
    getFriendChallengeSelectionProgress,
} from '@/lib/friend-challenge-categories'
import { extractInviteTokenFromInput } from '@/lib/friend-invite'

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
    categoryId: string
    name: string
    airDate?: string | null
    round?: 'SINGLE' | 'DOUBLE'
    answeredCount?: number
    _count?: {
        questions?: number
    }
}

interface ChallengeCategoryChoice extends CustomCategorySelection {
    id: string
    name: string
    questionCount?: number
    answeredCount?: number
}

interface ChallengeComposerDraft {
    opponentId: string
    mode: 'PRACTICE' | 'GAME'
    categorySelection: FriendChallengeCategorySelection
    categoryCount: number
    categoryChoices: ChallengeCategoryChoice[]
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

interface OwnFriendInvite {
    code: string
    rawCode: string | null
    inviteToken: string | null
    allowFriendRequests: boolean
}

type InviteState =
    | 'ready'
    | 'self'
    | 'already_friends'
    | 'incoming_pending'
    | 'outgoing_pending'
    | 'blocked'
    | 'requests_disabled'

interface InvitePreview {
    state: InviteState
    canSendRequest: boolean
    requestId?: string | null
    inviter: Pick<FriendProfile, 'id' | 'displayName' | 'selectedIcon' | 'avatarBackground'>
    code: string | null
}

type CompareWinner = 'VIEWER' | 'FRIEND' | 'TIE'
type ComparisonView = 'profile' | 'head-to-head'
type ComparisonRound = 'SINGLE' | 'DOUBLE' | 'FINAL'

interface ComparisonRoundStat {
    round: ComparisonRound
    roundName: string
    totalAnswered: number
    correctAnswers: number
    totalPoints: number
    accuracy: number
}

interface FriendComparisonProfile {
    id: string
    displayName: string | null
    selectedIcon: string | null
    avatarBackground: string | null
    currentStreak: number
    longestStreak: number
    createdAt: string
    stats: {
        answeredCount: number
        correctCount: number
        accuracy: number
        totalPoints: number
        tripleStumpersAnswered: number
        roundStats: ComparisonRoundStat[]
        dailyCompletedCount: number
        dailyCorrectCount: number
        dailyAccuracy: number
        recentDailyCorrectCount: number
        recentDailySampleSize: number
        recentDailyAccuracy: number
    }
}

interface FriendComparisonPayload {
    viewer: FriendComparisonProfile
    friend: FriendComparisonProfile
    comparison: {
        currentStreakDelta: number
        longestStreakDelta: number
        overallAccuracyDelta: number
        dailyAccuracyDelta: number
        answeredCountDelta: number
        friendshipSince: string | null
        summary: string
        matchupStats: Array<{
            id: string
            label: string
            winner: CompareWinner
            detail: string
        }>
        roundMatchups: Array<{
            round: ComparisonRound
            roundName: string
            winner: CompareWinner
            detail: string
        }>
        insights: string[]
        headToHeadInsights: string[]
        headToHead: {
            completedCount: number
            viewerWins: number
            friendWins: number
            ties: number
            averageMargin: number | null
            viewerAverageScore: number | null
            friendAverageScore: number | null
            viewerBestScore: number | null
            friendBestScore: number | null
            lastCompletedAt: string | null
            lastResult: CompareWinner | null
            recentMatches: Array<{
                completedAt: string
                viewerScore: number | null
                friendScore: number | null
                winner: CompareWinner
            }>
        }
    }
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

interface BlockConfirmationState {
    blockedUserId: string
    displayName: string
}

interface RemoveFriendConfirmationState {
    friendId: string
    displayName: string
}

type FriendSection = 'friends' | 'connect' | 'requests' | 'challenges' | 'activity' | 'compare' | 'settings'

type ActivityFilter = 'all' | 'requests' | 'challenges' | 'completed'

const DEFAULT_FRIEND_CHALLENGE_CATEGORY_COUNT = 3

const ACTIVITY_FILTER_OPTIONS: { value: ActivityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'requests', label: 'Requests' },
    { value: 'challenges', label: 'Challenges' },
    { value: 'completed', label: 'Completed' },
]

function matchesActivityFilter(activity: FriendActivity, filter: ActivityFilter): boolean {
    if (filter === 'all') {
        return true
    }

    if (filter === 'requests') {
        return activity.activityType.startsWith('FRIEND_REQUEST_')
    }

    if (filter === 'challenges') {
        return activity.activityType !== 'CHALLENGE_COMPLETED' && activity.activityType.startsWith('CHALLENGE_')
    }

    return activity.activityType === 'CHALLENGE_COMPLETED'
}

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

function inviteStateMessage(invite: InvitePreview): string {
    switch (invite.state) {
        case 'self':
            return 'This is your invite.'
        case 'already_friends':
            return 'You are already friends.'
        case 'incoming_pending':
            return 'They already sent you a request. Accept it below.'
        case 'outgoing_pending':
            return 'Friend request already sent.'
        case 'blocked':
            return 'You cannot connect with this account.'
        case 'requests_disabled':
            return 'This user is not accepting friend requests right now.'
        case 'ready':
        default:
            return 'Ready to send a friend request.'
    }
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

function formatPercent(value: number): string {
    return `${value.toFixed(1).replace(/\.0$/, '')}%`
}

function formatCalendarDate(value: string | null | undefined): string | null {
    if (!value) {
        return null
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return null
    }

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

function formatChallengeCategoryAirDate(value: string | null | undefined): string {
    if (!value) {
        return 'Undated set'
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) {
        return value
    }

    const date = new Date(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10) - 1, Number.parseInt(match[3], 10))
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

function formatChallengeCategoryVariantMeta(choice: {
    round?: 'SINGLE' | 'DOUBLE'
    airDate?: string | null
}): string {
    const roundLabel = choice.round === 'DOUBLE' ? 'Double Jeopardy' : 'Single Jeopardy'
    return `${roundLabel} • ${formatChallengeCategoryAirDate(choice.airDate)}`
}

function toChallengeCategoryChoice(category: CategorySearchResult): ChallengeCategoryChoice {
    return {
        id: category.id || getCustomCategorySelectionKey({
            categoryId: category.categoryId,
            airDate: category.airDate || '',
            round: category.round || 'SINGLE',
        }),
        categoryId: category.categoryId,
        airDate: category.airDate || '',
        round: category.round || 'SINGLE',
        name: category.name,
        questionCount: category._count?.questions,
        answeredCount: category.answeredCount,
    }
}

function matchupToneClasses(winner: CompareWinner): string {
    switch (winner) {
        case 'VIEWER':
            return 'border-blue-200 bg-blue-50 text-blue-900'
        case 'FRIEND':
            return 'border-amber-200 bg-amber-50 text-amber-900'
        case 'TIE':
        default:
            return 'border-slate-200 bg-slate-50 text-slate-700'
    }
}

function comparisonToggleClasses(isActive: boolean): string {
    return isActive ? 'btn-primary' : 'btn-outline'
}

function formatMatchScore(value: number | null): string {
    return value === null ? '—' : value.toLocaleString()
}

function roundAccentClasses(round: ComparisonRound): {
    badge: string
    progress: string
} {
    switch (round) {
        case 'DOUBLE':
            return {
                badge: 'bg-violet-100 text-violet-700',
                progress: 'bg-violet-500',
            }
        case 'FINAL':
            return {
                badge: 'bg-amber-100 text-amber-700',
                progress: 'bg-amber-500',
            }
        case 'SINGLE':
        default:
            return {
                badge: 'bg-blue-100 text-blue-700',
                progress: 'bg-blue-500',
            }
    }
}

function bestRoundLabel(roundStats: ComparisonRoundStat[]): string {
    const roundsWithAnswers = roundStats.filter((round) => round.totalAnswered > 0)
    if (roundsWithAnswers.length === 0) {
        return 'No round history yet'
    }

    const bestRound = roundsWithAnswers.reduce((best, round) => {
        if (round.accuracy === best.accuracy) {
            return round.totalPoints > best.totalPoints ? round : best
        }

        return round.accuracy > best.accuracy ? round : best
    })

    return `${bestRound.roundName} (${formatPercent(bestRound.accuracy)})`
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
    const [ownInvite, setOwnInvite] = useState<OwnFriendInvite | null>(null)
    const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
    const [inviteLoading, setInviteLoading] = useState(false)
    const [inviteActionMessage, setInviteActionMessage] = useState('')
    const [inviteCodeCopied, setInviteCodeCopied] = useState(false)
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
    const [categoryQuickPicks, setCategoryQuickPicks] = useState<CategorySearchResult[]>([])
    const [categorySearchLoading, setCategorySearchLoading] = useState(false)
    const [creatingChallenge, setCreatingChallenge] = useState(false)
    const [comparison, setComparison] = useState<FriendComparisonPayload | null>(null)
    const [comparisonView, setComparisonView] = useState<ComparisonView>('profile')
    const [comparisonLoading, setComparisonLoading] = useState(false)
    const [activeChallengeConflict, setActiveChallengeConflict] = useState<ActiveChallengeConflict | null>(null)
    const [challengeComposerAlert, setChallengeComposerAlert] = useState<ChallengeComposerAlert | null>(null)
    const [endChallengeModal, setEndChallengeModal] = useState<EndChallengeModalState | null>(null)
    const [processingEndChallenge, setProcessingEndChallenge] = useState(false)
    const [blockConfirmation, setBlockConfirmation] = useState<BlockConfirmationState | null>(null)
    const [processingBlockConfirmation, setProcessingBlockConfirmation] = useState(false)
    const [removeFriendConfirmation, setRemoveFriendConfirmation] = useState<RemoveFriendConfirmationState | null>(null)
    const [processingRemoveFriendConfirmation, setProcessingRemoveFriendConfirmation] = useState(false)
    const [isRefreshInviteConfirmationOpen, setIsRefreshInviteConfirmationOpen] = useState(false)
    const [isMobileSectionMenuOpen, setIsMobileSectionMenuOpen] = useState(false)
    const [isFeaturedBoardsExpanded, setIsFeaturedBoardsExpanded] = useState(false)
    const refreshInFlightRef = useRef(false)
    const inviteCodeCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const appliedQueryTabRef = useRef<string | null>(null)
    const processedInviteTokenRef = useRef<string | null>(null)
    const customCategorySearchInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        return () => {
            if (inviteCodeCopiedTimeoutRef.current) {
                clearTimeout(inviteCodeCopiedTimeoutRef.current)
            }
        }
    }, [])

    useEffect(() => {
        setInviteCodeCopied(false)
        if (inviteCodeCopiedTimeoutRef.current) {
            clearTimeout(inviteCodeCopiedTimeoutRef.current)
            inviteCodeCopiedTimeoutRef.current = null
        }
    }, [ownInvite?.code])

    const activateSection = useCallback((section: FriendSection) => {
        appliedQueryTabRef.current = section
        setActiveSection(section)
        router.replace(`/friends?tab=${section}`, { scroll: false })
    }, [router])

    const goToChallengesTab = useCallback(() => {
        activateSection('challenges')
    }, [activateSection])

    const loadInvitePreview = useCallback(async (params: { token?: string; code?: string }) => {
        const query = new URLSearchParams()
        if (params.token) {
            query.set('token', params.token)
        }
        if (params.code) {
            query.set('code', params.code)
        }

        setInviteLoading(true)
        try {
            const response = await fetch(`/api/friends/invite?${query.toString()}`, {
                cache: 'no-store',
            })
            if (!response.ok) {
                const payload = await response.json()
                throw new Error(payload?.error || 'Unable to load this invite')
            }

            const payload = await response.json() as { invite?: InvitePreview }
            setInvitePreview(payload.invite || null)
            activateSection('connect')
            setInviteActionMessage('')
        } finally {
            setInviteLoading(false)
        }
    }, [activateSection])

    const loadFriendData = useCallback(async (
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
            const [friendsResponse, challengeResponse, activityResponse, inviteResponse] = await Promise.all([
                fetch('/api/friends?status=pending', { cache: 'no-store' }),
                fetch('/api/challenges/friends?status=all&includeExpired=true', { cache: 'no-store' }),
                fetch('/api/friends/activity?limit=40', { cache: 'no-store' }),
                fetch('/api/friends/invite', { cache: 'no-store' }),
            ])

            if (!friendsResponse.ok || !challengeResponse.ok || !activityResponse.ok || !inviteResponse.ok) {
                throw new Error('Unable to load friend data')
            }

            const friendsPayload = await friendsResponse.json() as FriendDataPayload
            const challengePayload = await challengeResponse.json() as { challenges: ChallengeRecord[] }
            const activityPayload = await activityResponse.json() as { activities: FriendActivity[] }
            const invitePayload = await inviteResponse.json() as { invite?: OwnFriendInvite }
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
            setOwnInvite(invitePayload.invite || null)

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
    }, [])

    const loadComparison = useCallback(async (friendId: string) => {
        if (!friendId) return
        setErrorMessage('')
        setComparisonLoading(true)
        try {
            const response = await fetch(`/api/friends/streak-comparison?friendId=${friendId}`, {
                cache: 'no-store',
            })
            if (!response.ok) {
                const body = await response.json()
                throw new Error(body?.error || 'Unable to compare with this friend')
            }
            const payload = await response.json() as FriendComparisonPayload
            setComparison(payload)
        } catch (error) {
            const typed = error as Error
            setErrorMessage(typed.message)
            setComparison(null)
        } finally {
            setComparisonLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadFriendData()
    }, [loadFriendData])

    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (!tabParam || appliedQueryTabRef.current === tabParam) {
            return
        }

        const section = tabParam as FriendSection
        if (
            section === 'friends'
            || section === 'connect'
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
        const inviteToken = searchParams.get('invite')
        if (!inviteToken || processedInviteTokenRef.current === inviteToken) {
            return
        }

        processedInviteTokenRef.current = inviteToken
        appliedQueryTabRef.current = 'connect'
        setActiveSection('connect')

        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.set('tab', 'connect')
        router.replace(`/friends?${nextParams.toString()}`, { scroll: false })
        void loadInvitePreview({ token: inviteToken }).catch(markError)
    }, [loadInvitePreview, router, searchParams])

    useEffect(() => {
        const pollId = window.setInterval(() => {
            void loadFriendData({ silent: true })
        }, 5000)

        const handleVisibilityRefresh = () => {
            if (!document.hidden) {
                void loadFriendData({ silent: true })
            }
        }

        window.addEventListener('focus', handleVisibilityRefresh)
        document.addEventListener('visibilitychange', handleVisibilityRefresh)

        return () => {
            window.clearInterval(pollId)
            window.removeEventListener('focus', handleVisibilityRefresh)
            document.removeEventListener('visibilitychange', handleVisibilityRefresh)
        }
    }, [loadFriendData])

    useEffect(() => {
        const eventSource = new EventSource('/api/friends/events')

        eventSource.addEventListener('social_update', () => {
            void loadFriendData({ silent: true })
            if (selectedFriendId) {
                void loadComparison(selectedFriendId)
            }
        })

        eventSource.onerror = () => {
            eventSource.close()
        }

        return () => {
            eventSource.close()
        }
    }, [loadComparison, loadFriendData, selectedFriendId])

    useEffect(() => {
        if (!selectedFriendId) {
            setComparison(null)
            return
        }

        void loadComparison(selectedFriendId)
    }, [loadComparison, selectedFriendId])

    useEffect(() => {
        if (!selectedFriendId) {
            return
        }

        if (!friends.some((friend) => friend.id === selectedFriendId)) {
            setSelectedFriendId('')
            setComparison(null)
        }
    }, [friends, selectedFriendId])

    useEffect(() => {
        if (!challengeComposer) {
            return
        }

        if (friends.length === 0 || !friends.some((friend) => friend.id === challengeComposer.opponentId)) {
            setChallengeComposer(null)
            setActiveChallengeConflict(null)
            setChallengeComposerAlert(null)
            setCategorySearchQuery('')
            setCategorySearchResults([])
            setCategoryQuickPicks([])
            setCategorySearchLoading(false)
            setCreatingChallenge(false)
            activateSection('connect')
        }
    }, [activateSection, challengeComposer, friends])

    useEffect(() => {
        if (activeSection !== 'compare') {
            return
        }

        if (friends.length === 0) {
            activateSection('connect')
        }
    }, [activeSection, activateSection, friends.length])

    useEffect(() => {
        if (!isMobileSectionMenuOpen) {
            return
        }

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [isMobileSectionMenuOpen])

    useEffect(() => {
        if (challengeComposer?.categorySelection !== 'CUSTOM') {
            setCategoryQuickPicks([])
            setIsFeaturedBoardsExpanded(false)
            return
        }

        const selectedCategoryIdsQuery = challengeComposer.categoryChoices
            .map((choice) => choice.categoryId)
            .join(',')
        let cancelled = false

        void (async () => {
            try {
                const params = new URLSearchParams({
                    suggested: 'true',
                    variantMode: 'episode',
                    round: 'SINGLE',
                    minQuestions: '5',
                    limit: '8',
                })
                if (selectedCategoryIdsQuery) {
                    params.set('excludeIds', selectedCategoryIdsQuery)
                }

                const response = await fetch(
                    `/api/categories/search?${params.toString()}`,
                )
                if (!response.ok) {
                    throw new Error('Unable to load quick picks')
                }

                const payload = await response.json() as CategorySearchResult[]
                if (!cancelled) {
                    setCategoryQuickPicks(payload)
                }
            } catch {
                if (!cancelled) {
                    setCategoryQuickPicks([])
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [challengeComposer?.categoryChoices, challengeComposer?.categorySelection])

    useEffect(() => {
        if (challengeComposer?.categorySelection !== 'CUSTOM') {
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
                const response = await fetch(
                    `/api/categories/search?q=${encodeURIComponent(query)}&page=1&variantMode=episode&round=SINGLE&minQuestions=5&limit=12`,
                )
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
        }, 200)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [categorySearchQuery, challengeComposer?.categorySelection])

    useEffect(() => {
        if (challengeComposer?.categorySelection !== 'CUSTOM') {
            return
        }

        const timer = window.setTimeout(() => {
            customCategorySearchInputRef.current?.focus()
        }, 40)

        return () => window.clearTimeout(timer)
    }, [challengeComposer?.categorySelection])

    const sendFriendRequest = async (targetOverride?: string) => {
        const target = (targetOverride || targetInput).trim()
        if (!target) return

        const response = await fetch('/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target,
            }),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to send friend request')
        }

        setTargetInput('')
        setInviteActionMessage('Friend request sent.')
        setInvitePreview((previous) => (
            previous && previous.inviter.id === target
                ? { ...previous, state: 'outgoing_pending', canSendRequest: false }
                : previous
        ))
        await loadFriendData()
    }

    const submitTargetInput = async () => {
        const trimmed = targetInput.trim()
        if (!trimmed) {
            return
        }

        const inviteToken = extractInviteTokenFromInput(trimmed)
        if (inviteToken) {
            await loadInvitePreview({ token: inviteToken })
            setTargetInput('')
            return
        }

        await sendFriendRequest(trimmed)
    }

    const sendRequestFromPreview = async () => {
        if (!invitePreview?.canSendRequest) {
            return
        }

        await sendFriendRequest(invitePreview.inviter.id)
    }

    const acceptRequestFromPreview = async () => {
        if (!invitePreview?.requestId) {
            return
        }

        await respondToRequest(invitePreview.requestId, 'accept')
        setInviteActionMessage('Friend request accepted.')
        setInvitePreview((previous) => (
            previous ? { ...previous, state: 'already_friends', canSendRequest: false } : previous
        ))
    }

    const cancelRequestFromPreview = async () => {
        if (!invitePreview?.requestId) {
            return
        }

        await respondToRequest(invitePreview.requestId, 'cancel')
        setInviteActionMessage('Friend request cancelled.')
        setInvitePreview((previous) => (
            previous ? { ...previous, state: 'ready', canSendRequest: true, requestId: null } : previous
        ))
    }

    const buildInviteUrl = () => {
        if (!ownInvite?.inviteToken || typeof window === 'undefined') {
            return ''
        }

        return `${window.location.origin}/friends?invite=${encodeURIComponent(ownInvite.inviteToken)}`
    }

    const copyInviteText = async (value: string, successMessage?: string) => {
        if (!value) {
            throw new Error('Invite is not ready yet')
        }
        await navigator.clipboard.writeText(value)
        if (successMessage) {
            setInviteActionMessage(successMessage)
        }
    }

    const showInviteCodeCopiedState = () => {
        setInviteCodeCopied(true)
        if (inviteCodeCopiedTimeoutRef.current) {
            clearTimeout(inviteCodeCopiedTimeoutRef.current)
        }
        inviteCodeCopiedTimeoutRef.current = setTimeout(() => {
            setInviteCodeCopied(false)
            inviteCodeCopiedTimeoutRef.current = null
        }, 1800)
    }

    const shareInviteNatively = async () => {
        const inviteUrl = buildInviteUrl()
        const inviterName = user.displayName || 'A friend'
        const shareTitle = `${inviterName} invited you to trivrdy`
        const shareText = [
            `${inviterName} wants to connect on trivrdy.`,
            'Add me as a friend to compare daily challenge results and send head-to-head boards.',
            ownInvite?.code ? `Friend code: ${ownInvite.code}` : null,
        ].filter(Boolean).join('\n')

        if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url: inviteUrl,
            })
            setInviteActionMessage('Invite shared.')
            return
        }

        await copyInviteText(inviteUrl, 'Invite link copied.')
    }

    const openRefreshInviteConfirmation = () => {
        setIsRefreshInviteConfirmationOpen(true)
    }

    const closeRefreshInviteConfirmation = () => {
        if (inviteLoading) {
            return
        }
        setIsRefreshInviteConfirmationOpen(false)
    }

    const confirmRefreshInvite = async () => {
        if (inviteLoading) {
            return
        }

        try {
            await rotateInvite()
            setIsRefreshInviteConfirmationOpen(false)
        } catch (error) {
            markError(error)
        }
    }

    const rotateInvite = async () => {
        const response = await fetch('/api/friends/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'rotate' }),
        })

        if (!response.ok) {
            const payload = await response.json()
            throw new Error(payload?.error || 'Unable to refresh your invite')
        }

        const payload = await response.json() as { invite?: OwnFriendInvite }
        setOwnInvite(payload.invite || null)
        setInviteActionMessage('Invite link and code refreshed.')
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
        if (friends.length === 0 && !opponentId) {
            activateSection('connect')
            return
        }

        const nextOpponentId = opponentId || friends[0]?.id || ''
        setChallengeComposer({
            opponentId: nextOpponentId,
            mode: 'GAME',
            categorySelection: 'RANDOM',
            categoryCount: DEFAULT_FRIEND_CHALLENGE_CATEGORY_COUNT,
            categoryChoices: [],
        })
        setActiveChallengeConflict(null)
        setChallengeComposerAlert(null)
        setCategorySearchQuery('')
        setCategorySearchResults([])
        setCategoryQuickPicks([])
    }

    const closeChallengeComposer = () => {
        setChallengeComposer(null)
        setActiveChallengeConflict(null)
        setChallengeComposerAlert(null)
        setCategorySearchQuery('')
        setCategorySearchResults([])
        setCategoryQuickPicks([])
        setCategorySearchLoading(false)
        setCreatingChallenge(false)
    }

    const setChallengeOpponent = (opponentId: string) => {
        if (!opponentId) {
            closeChallengeComposer()
            activateSection('connect')
            return
        }

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

    const setChallengeComposerSelection = (selection: FriendChallengeCategorySelection) => {
        setChallengeComposer((previous) => {
            if (!previous) {
                return previous
            }
            return {
                ...previous,
                categorySelection: selection,
            }
        })
        setCategorySearchQuery('')
        setCategorySearchResults([])
        setChallengeComposerAlert(null)
    }

    const setChallengeCategoryCount = (nextCount: number) => {
        setChallengeComposer((previous) => {
            if (!previous) {
                return previous
            }
            const bounded = clampFriendChallengeCategoryCount(nextCount)
            return {
                ...previous,
                categoryCount: bounded,
                categoryChoices: previous.categoryChoices.slice(0, bounded),
            }
        })
    }

    const toggleChallengeCategoryChoice = (category: CategorySearchResult | ChallengeCategoryChoice) => {
        setChallengeComposer((previous) => {
            if (!previous || previous.categorySelection !== 'CUSTOM') {
                return previous
            }

            const nextChoice = 'categoryId' in category
                ? toChallengeCategoryChoice(category)
                : category

            const exactIndex = previous.categoryChoices.findIndex((choice) => choice.id === nextChoice.id)
            if (exactIndex !== -1) {
                return {
                    ...previous,
                    categoryChoices: previous.categoryChoices.filter((choice) => choice.id !== nextChoice.id),
                }
            }

            const sameCategoryIndex = previous.categoryChoices.findIndex((choice) => choice.categoryId === nextChoice.categoryId)
            if (sameCategoryIndex !== -1) {
                return {
                    ...previous,
                    categoryChoices: previous.categoryChoices.map((choice, index) => (
                        index === sameCategoryIndex ? nextChoice : choice
                    )),
                }
            }

            if (previous.categoryChoices.length >= previous.categoryCount) {
                return previous
            }

            return {
                ...previous,
                categoryChoices: [...previous.categoryChoices, nextChoice],
            }
        })
    }

    const addQuickPickCategoriesToChallenge = () => {
        setChallengeComposer((previous) => {
            if (!previous || previous.categorySelection !== 'CUSTOM') {
                return previous
            }

            const selectedCategoryIds = new Set(previous.categoryChoices.map((choice) => choice.categoryId))
            const needed = previous.categoryCount - previous.categoryChoices.length
            if (needed <= 0) {
                return previous
            }

            const additions = categoryQuickPicks
                .filter((category) => !selectedCategoryIds.has(category.categoryId))
                .slice(0, needed)
                .map(toChallengeCategoryChoice)

            if (additions.length === 0) {
                return previous
            }

            return {
                ...previous,
                categoryChoices: [...previous.categoryChoices, ...additions],
            }
        })
    }

    const handleChallengeCategorySearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') {
            return
        }

        event.preventDefault()
        if (!challengeComposer || challengeComposer.categorySelection !== 'CUSTOM') {
            return
        }

        const firstAvailable = categorySearchResults.find((category) => (
            !challengeComposer.categoryChoices.some((choice) => choice.categoryId === category.categoryId)
        ))

        if (firstAvailable) {
            toggleChallengeCategoryChoice(firstAvailable)
        }
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
        if (categorySelection === 'CUSTOM' && categoryChoices.length === 0) {
            setChallengeComposerAlert({
                tone: 'warning',
                message: 'Pick at least one category for a custom board.',
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
                    categoryIds: categorySelection === 'CUSTOM' ? categoryChoices.map((choice) => choice.categoryId) : undefined,
                    categorySelections: categorySelection === 'CUSTOM'
                        ? categoryChoices.map((choice) => ({
                            categoryId: choice.categoryId,
                            airDate: choice.airDate,
                            round: choice.round,
                        }))
                        : undefined,
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
                    categoryIds: categorySelection === 'CUSTOM' ? categoryChoices.map((choice) => choice.categoryId) : undefined,
                    categorySelections: categorySelection === 'CUSTOM'
                        ? categoryChoices.map((choice) => ({
                            categoryId: choice.categoryId,
                            airDate: choice.airDate,
                            round: choice.round,
                        }))
                        : undefined,
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
        const isWaitingOnOpponent = isViewerWaitingOnChallenge(challenge)
        setEndChallengeModal({
            mode: 'end-active',
            challengeId: challenge.id,
            title: isWaitingOnOpponent ? 'Cancel waiting challenge?' : 'End active challenge?',
            message: `This will cancel the active challenge between ${challengerName} and ${opponentName}. This cannot be undone.`,
            confirmLabel: isWaitingOnOpponent ? 'Yes, cancel challenge' : 'Yes, end challenge',
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

    const openBlockConfirmation = (blockedUserId: string, displayName: string) => {
        setBlockConfirmation({
            blockedUserId,
            displayName,
        })
    }

    const closeBlockConfirmation = () => {
        if (processingBlockConfirmation) {
            return
        }
        setBlockConfirmation(null)
    }

    const confirmBlockAction = async () => {
        if (!blockConfirmation || processingBlockConfirmation) {
            return
        }

        setProcessingBlockConfirmation(true)
        try {
            await setFriendBlock(blockConfirmation.blockedUserId, 'block')
            setBlockConfirmation(null)
        } catch (error) {
            markError(error)
        } finally {
            setProcessingBlockConfirmation(false)
        }
    }

    const openRemoveFriendConfirmation = (friendId: string, displayName: string) => {
        setRemoveFriendConfirmation({
            friendId,
            displayName,
        })
    }

    const closeRemoveFriendConfirmation = () => {
        if (processingRemoveFriendConfirmation) {
            return
        }
        setRemoveFriendConfirmation(null)
    }

    const setRequestBlock = async (request: FriendRequestPayload) => {
        const blockedUserId = request.fromUserId === user.id ? request.toUserId : request.fromUserId
        if (!blockedUserId) {
            setErrorMessage('Could not identify user to block')
            return
        }

        openBlockConfirmation(blockedUserId, friendlyName(request))
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

    const confirmRemoveFriendAction = async () => {
        if (!removeFriendConfirmation || processingRemoveFriendConfirmation) {
            return
        }

        setProcessingRemoveFriendConfirmation(true)
        try {
            await removeFriend(removeFriendConfirmation.friendId)
            setRemoveFriendConfirmation(null)
        } catch (error) {
            markError(error)
        } finally {
            setProcessingRemoveFriendConfirmation(false)
        }
    }

    const markError = (error: unknown) => {
        setInviteActionMessage('')
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
    const filteredActivities = useMemo(
        () => activities.filter((activity) => matchesActivityFilter(activity, activityFilter)),
        [activities, activityFilter],
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

    const isViewerWaitingOnChallenge = (challenge: ChallengeRecord) => {
        if (challenge.mode !== 'GAME' || challenge.status !== 'ACCEPTED') {
            return false
        }

        const viewerIsChallenger = challenge.challengerUserId === user.id
        const viewerScore = viewerIsChallenger ? challenge.challengerScore : challenge.opponentScore
        const opponentScore = viewerIsChallenger ? challenge.opponentScore : challenge.challengerScore

        return viewerScore !== null && opponentScore === null
    }

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

        const topEdge = comparison.comparison.matchupStats.find((stat) => stat.winner !== 'TIE')
        if (!topEdge) {
            return 'Very even matchup'
        }

        return topEdge.winner === 'VIEWER'
            ? `You lead in ${topEdge.label.toLowerCase()}`
            : `${comparisonFriendName} leads in ${topEdge.label.toLowerCase()}`
    }

    const comparisonProfileMatchups = comparison?.comparison.matchupStats.filter((stat) => stat.id !== 'head-to-head') || []
    const comparisonFriendName = comparison?.friend.displayName || 'Friend'
    const pendingRequestsCount = incomingRequests.length + outgoingRequests.length
    const activeChallenges = useMemo(
        () => challenges.filter((challenge) => challenge.status === 'PENDING' || challenge.status === 'ACCEPTED'),
        [challenges],
    )
    const resolvedChallenges = useMemo(
        () => challenges.filter((challenge) => challenge.status !== 'PENDING' && challenge.status !== 'ACCEPTED'),
        [challenges],
    )
    const friendNavGroups: Array<{
        label: string
        items: Array<{
            id: FriendSection
            label: string
            description: string
            badge?: string
        }>
    }> = [
        {
            label: 'Connections',
            items: [
                {
                    id: 'connect',
                    label: 'Add Friend',
                    description: 'Share your code or use an invite link',
                },
                {
                    id: 'friends',
                    label: 'Friends',
                    description: `${friends.length} people in your circle`,
                    badge: friends.length.toString(),
                },
                {
                    id: 'requests',
                    label: 'Requests',
                    description: 'Pending incoming and outgoing invites',
                    badge: pendingRequestsCount > 0 ? pendingRequestsCount.toString() : undefined,
                },
            ],
        },
        {
            label: 'Play',
            items: [
                {
                    id: 'challenges',
                    label: 'Challenges',
                    description: 'Create and resolve direct matchups',
                    badge: pendingChallengeCount > 0 ? pendingChallengeCount.toString() : undefined,
                },
                {
                    id: 'compare',
                    label: 'Compare',
                    description: 'Profile stats and rivalry history',
                },
                {
                    id: 'activity',
                    label: 'Activity',
                    description: 'Recent social and challenge events',
                },
            ],
        },
        {
            label: 'Controls',
            items: [
                {
                    id: 'settings',
                    label: 'Privacy & Blocking',
                    description: 'Control visibility and incoming requests',
                },
            ],
        },
    ]
    const activeFriendNavItem = friendNavGroups
        .flatMap((group) => group.items)
        .find((item) => item.id === activeSection)
    const activeFriendNavGroupLabel = friendNavGroups.find((group) =>
        group.items.some((item) => item.id === activeSection),
    )?.label || 'Friends'
    const friendSectionDetails: Record<FriendSection, { title: string; subtitle: string }> = {
        connect: {
            title: 'Add a friend',
            subtitle: 'Share your code, paste theirs, and keep request controls close without extra noise.',
        },
        friends: {
            title: 'Your friends',
            subtitle: 'Keep your circle tidy, start a challenge, or open a deeper comparison in one step.',
        },
        requests: {
            title: 'Requests',
            subtitle: 'Approve incoming requests and keep track of the invites you already sent.',
        },
        challenges: {
            title: 'Challenges',
            subtitle: 'Create direct matchups, finish live rounds, and keep open games moving.',
        },
        compare: {
            title: 'Compare',
            subtitle: 'Start with overall profile strength, then switch into head-to-head history when you need it.',
        },
        activity: {
            title: 'Activity',
            subtitle: 'A simple feed for recent friend, request, and challenge updates.',
        },
        settings: {
            title: 'Privacy & blocking',
            subtitle: 'Keep profile visibility, request access, and blocked users in one calm place.',
        },
    }
    const currentFriendSection = friendSectionDetails[activeSection]
    const comparisonRoundMatchups = comparison?.comparison.roundMatchups || []
    const customSelectionProgress = challengeComposer && challengeComposer.categorySelection === 'CUSTOM'
        ? getFriendChallengeSelectionProgress(
            challengeComposer.categoryChoices.length,
            challengeComposer.categoryCount,
        )
        : null
    const categoryQuickPickOptions = useMemo(() => {
        if (!challengeComposer || challengeComposer.categorySelection !== 'CUSTOM') {
            return []
        }

        const selectedCategoryIds = new Set(challengeComposer.categoryChoices.map((choice) => choice.categoryId))
        return categoryQuickPicks.filter((category) => !selectedCategoryIds.has(category.categoryId))
    }, [categoryQuickPicks, challengeComposer])
    const canSubmitChallengeComposer = Boolean(
        challengeComposer
        && challengeComposer.opponentId
        && (
            challengeComposer.categorySelection !== 'CUSTOM'
            || challengeComposer.categoryChoices.length > 0
        ),
    )
    const showChallengeComposerSubmitAction = Boolean(
        challengeComposer
        && (
            challengeComposer.categorySelection !== 'CUSTOM'
            || challengeComposer.categoryChoices.length > 0
        ),
    )
    const challengeComposerSubmitLabel = customSelectionProgress?.willAutoFill
        ? `Create Challenge + fill ${customSelectionProgress.remainingCount}`
        : 'Create Challenge'

    if (isLoading) {
        return <div className="container mx-auto px-4 py-8">Loading friends...</div>
    }

    return (
        <div className="friends-hub workspace-page">
            {errorMessage && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {errorMessage}
                </div>
            )}

            <div className="workspace-mobile-nav">
                <div className="workspace-mobile-nav-card">
                    <div className="workspace-mobile-nav-row">
                        <div className="workspace-mobile-nav-copy">
                            <div className="workspace-mobile-nav-kicker">{activeFriendNavGroupLabel}</div>
                            <div className="workspace-mobile-nav-title">{currentFriendSection.title}</div>
                            <div className="workspace-mobile-nav-subtitle">
                                {activeFriendNavItem?.description || currentFriendSection.subtitle}
                            </div>
                        </div>
                        <button
                            type="button"
                            className="workspace-mobile-nav-trigger"
                            onClick={() => setIsMobileSectionMenuOpen(true)}
                            aria-expanded={isMobileSectionMenuOpen}
                            aria-haspopup="dialog"
                        >
                            Sections
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                    {activeSection !== 'connect' ? (
                        <button
                            type="button"
                            className="workspace-mobile-nav-secondary w-full"
                            onClick={() => activateSection('connect')}
                        >
                            Add Friend
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="workspace-shell">
                <aside className="workspace-sidebar">
                    <div className="workspace-sidebar-card overflow-hidden">
                        <div className="workspace-sidebar-scroll">
                            {friendNavGroups.map((group) => (
                                <div key={group.label} className="workspace-nav-group">
                                    <div className="workspace-nav-label">{group.label}</div>
                                    <div className="space-y-2">
                                        {group.items.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => activateSection(item.id)}
                                                className={`workspace-nav-button ${activeSection === item.id ? 'active' : ''}`}
                                                aria-current={activeSection === item.id ? 'page' : undefined}
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-semibold">{item.label}</div>
                                                    <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {item.badge ? <span className="workspace-nav-badge">{item.badge}</span> : null}
                                                    <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <div className="workspace-main">
                    {activeSection !== 'connect' ? (
                        <section className="friends-cta-banner" aria-label="Add a friend call to action">
                            <div className="friends-cta-banner-copy">Add a friend</div>
                            <div className="friends-cta-banner-action">
                                <button
                                    type="button"
                                    className="btn-primary btn-sm"
                                    onClick={() => activateSection('connect')}
                                >
                                    Add Friend
                                </button>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === 'connect' && (
                        <section className="workspace-surface p-5 md:p-6">
                            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Share your code</div>
                                            <h2 className="mt-2 text-xl font-semibold text-slate-900">Invite a friend</h2>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-outline btn-sm"
                                            onClick={openRefreshInviteConfirmation}
                                            disabled={inviteLoading}
                                        >
                                            Refresh
                                        </button>
                                    </div>

                                    <div className="mt-4">
                                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-4 shadow-sm">
                                            <div className="min-w-0">
                                                <div className="text-2xl font-semibold tracking-[0.18em] text-slate-900">
                                                    {ownInvite?.code || 'Loading...'}
                                                </div>
                                                <div
                                                    className={`mt-1 text-xs font-medium transition-all duration-200 ${
                                                        inviteCodeCopied ? 'text-emerald-600' : 'text-blue-700'
                                                    }`}
                                                    aria-live="polite"
                                                >
                                                    {inviteCodeCopied ? 'Code copied' : 'Friend code'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                                                    inviteCodeCopied
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                                                }`}
                                                onClick={() => void copyInviteText(ownInvite?.code || '')
                                                    .then(showInviteCodeCopiedState)
                                                    .catch(markError)}
                                                disabled={!ownInvite?.code}
                                                aria-label={inviteCodeCopied ? 'Friend code copied' : 'Copy friend code'}
                                            >
                                                {inviteCodeCopied ? (
                                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 8 14l7.5-8" />
                                                    </svg>
                                                ) : (
                                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                                                        <rect x="7" y="3.5" width="9" height="11" rx="2" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 7H5A2.5 2.5 0 0 0 2.5 9.5V14A2.5 2.5 0 0 0 5 16.5h4.5" />
                                                    </svg>
                                                )}
                                                <span className="sr-only">{inviteCodeCopied ? 'Friend code copied' : 'Copy friend code'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="btn-primary btn-sm"
                                            onClick={() => void shareInviteNatively().catch(markError)}
                                            disabled={!ownInvite?.inviteToken || !friendSettings.allowFriendRequests}
                                        >
                                            Share invite
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-outline btn-sm"
                                            onClick={() => void copyInviteText(buildInviteUrl(), 'Invite link copied.').catch(markError)}
                                            disabled={!ownInvite?.inviteToken || !friendSettings.allowFriendRequests}
                                        >
                                            Copy link
                                        </button>
                                    </div>

                                    {inviteActionMessage ? (
                                        <p className="mt-3 text-sm text-blue-700">{inviteActionMessage}</p>
                                    ) : null}

                                    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-slate-900">Allow incoming requests</div>
                                            <div className="text-sm text-slate-500">
                                                {friendSettings.allowFriendRequests ? 'On' : 'Off'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={friendSettings.allowFriendRequests}
                                                onChange={(event) => void handleAllowRequestsChange(event.target.checked).catch(markError)}
                                                aria-label="Allow incoming friend requests"
                                            />
                                            <button
                                                type="button"
                                                className="text-sm font-medium text-blue-700 hover:text-blue-800"
                                                onClick={() => activateSection('settings')}
                                            >
                                                Privacy settings
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                    <h2 className="text-xl font-semibold text-slate-900">Use a code or invite link</h2>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Paste what your friend sent you and keep going.
                                    </p>
                                    <label className="mt-4 grid gap-1.5">
                                        <span className="text-sm font-medium text-slate-800">Friend code or invite link</span>
                                        <input
                                            value={targetInput}
                                            onChange={(event) => setTargetInput(event.target.value)}
                                            className="form-input bg-white text-gray-900 placeholder:text-gray-500"
                                            placeholder="ABCDE-FGHIJ or invite link"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => void submitTargetInput().catch(markError)}
                                        className="btn-primary mt-3 w-full"
                                        disabled={targetInput.trim().length === 0}
                                    >
                                        Continue
                                    </button>

                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                        <span>
                                            {pendingRequestsCount > 0
                                                ? `${incomingRequests.length} incoming • ${outgoingRequests.length} outgoing`
                                                : 'No pending requests right now'}
                                        </span>
                                        <button
                                            type="button"
                                            className="font-medium text-blue-700 hover:text-blue-800"
                                            onClick={() => activateSection('requests')}
                                        >
                                            Review requests
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {invitePreview ? (
                                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <UserAvatar
                                                displayName={invitePreview.inviter.displayName || 'Friend'}
                                                selectedIcon={invitePreview.inviter.selectedIcon}
                                                avatarBackground={invitePreview.inviter.avatarBackground}
                                                size="md"
                                            />
                                            <div>
                                                <div className="font-medium text-slate-900">
                                                    {invitePreview.inviter.displayName || 'A friend'}
                                                </div>
                                                <div className="mt-1 text-sm text-slate-600">{inviteStateMessage(invitePreview)}</div>
                                                {invitePreview.code ? (
                                                    <div className="mt-1 text-xs text-slate-500">Code: {invitePreview.code}</div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {invitePreview.canSendRequest ? (
                                                <button
                                                    type="button"
                                                    className="btn-primary btn-sm"
                                                    onClick={() => void sendRequestFromPreview().catch(markError)}
                                                    disabled={inviteLoading}
                                                >
                                                    Send friend request
                                                </button>
                                            ) : null}
                                            {invitePreview.state === 'incoming_pending' && invitePreview.requestId ? (
                                                <button
                                                    type="button"
                                                    className="btn-primary btn-sm"
                                                    onClick={() => void acceptRequestFromPreview().catch(markError)}
                                                    disabled={inviteLoading}
                                                >
                                                    Accept request
                                                </button>
                                            ) : null}
                                            {invitePreview.state === 'outgoing_pending' && invitePreview.requestId ? (
                                                <button
                                                    type="button"
                                                    className="btn-outline btn-sm"
                                                    onClick={() => void cancelRequestFromPreview().catch(markError)}
                                                    disabled={inviteLoading}
                                                >
                                                    Cancel request
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </section>
                    )}

                    {activeSection === 'friends' && (
                        <section className="workspace-surface p-5 md:p-6">
                            {friends.length === 0 ? (
                                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                                    <p className="text-sm text-slate-600">No friends yet. Open Add Friend to share your invite or paste a code.</p>
                                    <button
                                        type="button"
                                        className="btn-primary btn-sm mt-4"
                                        onClick={() => activateSection('connect')}
                                    >
                                        Open Add Friend
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-5 grid gap-4">
                                    {friends.map((friend) => (
                                        <div key={friend.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar
                                                        displayName={friend.displayName || friend.email || ''}
                                                        selectedIcon={friend.selectedIcon}
                                                        avatarBackground={friend.avatarBackground}
                                                        size="md"
                                                    />
                                                    <div>
                                                        <div className="font-medium text-slate-900">
                                                            {friend.displayName || friend.email || 'Unknown'}
                                                        </div>
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            {comparisonStatusLabel(friend.id)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-3 xl:min-w-[16rem] xl:items-end">
                                                    <div className="flex w-full flex-wrap items-center justify-between gap-3 xl:justify-end">
                                                        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                                            {isBlockedById(friend.id) ? 'Blocked' : 'Friend'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn-primary btn-sm"
                                                        onClick={() => {
                                                            activateSection('challenges')
                                                            openChallengeComposer(friend.id)
                                                        }}
                                                    >
                                                        Challenge
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-outline btn-sm"
                                                        onClick={() => {
                                                            setComparisonView('profile')
                                                            setSelectedFriendId(friend.id)
                                                            activateSection('compare')
                                                            void loadComparison(friend.id)
                                                        }}
                                                    >
                                                        Compare
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-2 sm:justify-end">
                                                    <button
                                                        type="button"
                                                        className="btn-outline btn-sm"
                                                        onClick={() => {
                                                            if (isBlockedById(friend.id)) {
                                                                void setFriendBlock(friend.id, 'unblock').catch(markError)
                                                                return
                                                            }

                                                            openBlockConfirmation(friend.id, friend.displayName || friend.email || 'this friend')
                                                        }}
                                                    >
                                                        {isBlockedById(friend.id) ? 'Unblock' : 'Block'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-outline btn-sm"
                                                        onClick={() =>
                                                            openRemoveFriendConfirmation(
                                                                friend.id,
                                                                friend.displayName || friend.email || 'this friend',
                                                            )
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {activeSection === 'requests' && (
                        <section className="workspace-surface p-5 md:p-6">
                            <div className="grid gap-4 xl:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-lg font-semibold text-slate-900">Incoming</h3>
                                        <span className="workspace-nav-badge">{incomingRequests.length}</span>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        {incomingRequests.length === 0 ? (
                                            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                                No incoming requests.
                                            </div>
                                        ) : (
                                            incomingRequests.map((request) => (
                                                <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar
                                                            displayName={request.fromUser.displayName || 'Unknown'}
                                                            selectedIcon={request.fromUser.selectedIcon}
                                                            avatarBackground={request.fromUser.avatarBackground}
                                                            size="sm"
                                                        />
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900">{friendlyName(request)} wants to connect</div>
                                                            {request.message ? (
                                                                <p className="mt-1 text-sm text-slate-600">“{request.message}”</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-2">
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
                                                        <button
                                                            type="button"
                                                            className="btn-outline btn-sm"
                                                            onClick={() => void setRequestBlock(request).catch(markError)}
                                                        >
                                                            Block {friendlyName(request)}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-lg font-semibold text-slate-900">Outgoing</h3>
                                        <span className="workspace-nav-badge">{outgoingRequests.length}</span>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        {outgoingRequests.length === 0 ? (
                                            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                                No outgoing requests.
                                            </div>
                                        ) : (
                                            outgoingRequests.map((request) => (
                                                <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar
                                                            displayName={request.toUser.displayName || 'Unknown'}
                                                            selectedIcon={request.toUser.selectedIcon}
                                                            avatarBackground={request.toUser.avatarBackground}
                                                            size="sm"
                                                        />
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900">
                                                                Sent to {request.toUser.displayName || request.toUser.email || 'Unknown'}
                                                            </div>
                                                            {request.message ? (
                                                                <p className="mt-1 text-sm text-slate-600">“{request.message}”</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn-outline btn-sm"
                                                            onClick={() => void respondToRequest(request.id, 'cancel').catch(markError)}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-outline btn-sm"
                                                            onClick={() => void setRequestBlock(request).catch(markError)}
                                                        >
                                                            Block {friendlyName(request)}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {activeSection === 'challenges' && (
                <section className="workspace-surface p-5 mt-0 md:p-6">
                    {friends.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                            <p className="text-sm text-slate-600">
                                Add friends first so you can start direct challenges.
                            </p>
                            <button
                                type="button"
                                className="btn-primary btn-sm mt-4"
                                onClick={() => activateSection('connect')}
                            >
                                Open Add Friend
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-sm text-slate-600">
                                    {activeChallenges.length > 0
                                        ? `${activeChallenges.length} open challenge${activeChallenges.length === 1 ? '' : 's'}`
                                        : 'No open challenges'}{' '}
                                    · {resolvedChallenges.length} recent result{resolvedChallenges.length === 1 ? '' : 's'}
                                </div>
                                <button
                                    type="button"
                                    className="btn-primary btn-sm"
                                    onClick={() => openChallengeComposer()}
                                >
                                    New Challenge
                                </button>
                            </div>
                            {challenges.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                                    No challenges yet. Start one when you want a direct matchup.
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {challenges.map((challenge) => {
                                        const draft = challengeScores[challenge.id] ?? {
                                            challengerScore: challenge.challengerScore?.toString() || '',
                                            opponentScore: challenge.opponentScore?.toString() || '',
                                        }
                                        const expiresSoon = challengeExpiresSoon(challenge)
                                        const isWaitingOnOpponent = isViewerWaitingOnChallenge(challenge)
                                        const winner = winnerCopy(challenge)
                                        const challengerName = formatUserLabel(challenge.challenger)
                                        const opponentName = formatUserLabel(challenge.opponent)
                                        const boardCategories = challenge.boardCategories || []
                                        return (
                                            <div key={challenge.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {challenge.challenger.displayName || 'Unknown'} vs {challenge.opponent.displayName || 'Unknown'}
                                                        </div>
                                                        <div className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${challengeStatusBadge(challenge)}`}>
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
                                                    <div className="flex flex-wrap gap-2">
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
                                                                {isWaitingOnOpponent ? 'Cancel' : 'End'}
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
                                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:p-4">
                                                        <p className="mb-2 text-sm text-gray-700">
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
                                                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 px-3 py-3 text-xs text-blue-700">
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
                                                            {challenge.status === 'COMPLETED'
                                                                ? 'Review Challenge Round'
                                                                : isWaitingOnOpponent
                                                                    ? 'Review while you wait'
                                                                    : 'Play Challenge Round'}
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
                <section className="workspace-surface p-5 mt-0 md:p-6">
                    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm text-slate-500">
                            Keep the feed simple: requests, challenge movement, or completed results.
                        </div>
                        <div className="flex flex-wrap gap-2">
                        {ACTIVITY_FILTER_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                                    activityFilter === option.value
                                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
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
                    </div>
                    {filteredActivities.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                            No activity in this view right now.
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredActivities.map((activity) => {
                                const copy = formatActivity(activity)
                                const actorName = formatUserLabel(activity.actorUser)
                                const relatedName = formatUserLabel(activity.relatedUser)
                                return (
                                    <div key={activity.id} className={`rounded-2xl border p-4 shadow-sm ${getActivityToneClass(copy.tone)}`}>
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
                <section className="workspace-surface p-5 mt-0 md:p-6">
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="w-full max-w-sm">
                            <label className="mb-2 block text-sm font-medium text-slate-700">Pick a friend</label>
                            <select
                                value={selectedFriendId}
                                onChange={(event) => {
                                    setComparisonView('profile')
                                    if (!event.target.value) {
                                        setSelectedFriendId('')
                                        setComparison(null)
                                        activateSection('connect')
                                        return
                                    }
                                    setSelectedFriendId(event.target.value)
                                }}
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
                        <div className="flex gap-2" role="tablist" aria-label="Comparison view">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={comparisonView === 'profile'}
                                className={`btn-sm rounded-full border ${comparisonToggleClasses(comparisonView === 'profile')}`}
                                onClick={() => setComparisonView('profile')}
                            >
                                Profile stats
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={comparisonView === 'head-to-head'}
                                className={`btn-sm rounded-full border ${comparisonToggleClasses(comparisonView === 'head-to-head')}`}
                                onClick={() => setComparisonView('head-to-head')}
                            >
                                Head-to-head
                            </button>
                        </div>
                    </div>

                    {comparisonLoading && selectedFriendId ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                            Loading comparison...
                        </div>
                    ) : comparison ? (
                        <div className="mt-5 space-y-5">
                            <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white p-5 shadow-sm">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Matchup Summary</div>
                                        <p className="mt-3 text-2xl font-semibold leading-tight text-slate-900">
                                            {comparison.comparison.summary}
                                        </p>
                                        <p className="mt-3 max-w-2xl text-sm text-slate-600">
                                            {comparison.comparison.friendshipSince
                                                ? `Friends since ${formatCalendarDate(comparison.comparison.friendshipSince)}. `
                                                : ''}
                                            {comparison.comparison.headToHead.completedCount > 0
                                                ? `Completed challenges: ${comparison.comparison.headToHead.viewerWins}-${comparison.comparison.headToHead.friendWins}${comparison.comparison.headToHead.ties > 0 ? ` with ${comparison.comparison.headToHead.ties} tie${comparison.comparison.headToHead.ties === 1 ? '' : 's'}` : ''}.`
                                                : 'No completed head-to-head challenges yet.'}
                                        </p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-600">
                                            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Average margin</div>
                                            <div className="mt-1 text-2xl font-semibold text-slate-900">
                                                {comparison.comparison.headToHead.averageMargin ?? '—'}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-600">
                                            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Best recent form</div>
                                            <div className="mt-1 text-base font-semibold text-slate-900">
                                                {comparison.viewer.stats.recentDailyAccuracy === comparison.friend.stats.recentDailyAccuracy
                                                    ? 'Even'
                                                    : comparison.viewer.stats.recentDailyAccuracy > comparison.friend.stats.recentDailyAccuracy
                                                        ? 'You'
                                                        : comparisonFriendName}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {comparisonView === 'profile' ? (
                                <>
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        {[
                                            {
                                                label: 'You',
                                                profile: comparison.viewer,
                                            },
                                            {
                                                label: comparisonFriendName,
                                                profile: comparison.friend,
                                            },
                                        ].map(({ label, profile }) => (
                                            <div key={`${label}-${profile.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar
                                                        displayName={profile.displayName || label}
                                                        selectedIcon={profile.selectedIcon}
                                                        avatarBackground={profile.avatarBackground}
                                                        size="md"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</div>
                                                        <div className="text-xl font-semibold text-slate-900">
                                                            {profile.displayName || label}
                                                        </div>
                                                        <div className="text-sm text-slate-500">
                                                            Joined {formatCalendarDate(profile.createdAt)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                                    <div className="stat-card p-4 shadow-none">
                                                        <div className="stat-label">Total points</div>
                                                        <div className="stat-value">{profile.stats.totalPoints.toLocaleString()}</div>
                                                    </div>
                                                    <div className="stat-card p-4 shadow-none">
                                                        <div className="stat-label">Accuracy</div>
                                                        <div className="stat-value text-green-600">{formatPercent(profile.stats.accuracy)}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            {profile.stats.correctCount}/{profile.stats.answeredCount}
                                                        </div>
                                                    </div>
                                                    <div className="stat-card p-4 shadow-none">
                                                        <div className="stat-label">Questions answered</div>
                                                        <div className="stat-value text-slate-900">{profile.stats.answeredCount.toLocaleString()}</div>
                                                    </div>
                                                    <div className="stat-card p-4 shadow-none bg-gradient-to-br from-amber-50 to-white">
                                                        <div className="stat-label">Triple stumpers</div>
                                                        <div className="stat-value text-amber-600">{profile.stats.tripleStumpersAnswered.toLocaleString()}</div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                    <div className="workspace-muted-card px-4 py-3">
                                                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Daily challenge</div>
                                                        <div className="mt-1 text-xl font-semibold text-slate-900">
                                                            {formatPercent(profile.stats.dailyAccuracy)}
                                                        </div>
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            {profile.stats.dailyCorrectCount}/{profile.stats.dailyCompletedCount} correct
                                                        </div>
                                                    </div>
                                                    <div className="workspace-muted-card px-4 py-3">
                                                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Best round</div>
                                                        <div className="mt-1 text-base font-semibold text-slate-900">
                                                            {bestRoundLabel(profile.stats.roundStats)}
                                                        </div>
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            Current streak {profile.currentStreak} · Best streak {profile.longestStreak}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                                                    Recent daily form:{' '}
                                                    {profile.stats.recentDailySampleSize > 0
                                                        ? `${profile.stats.recentDailyCorrectCount}/${profile.stats.recentDailySampleSize} (${formatPercent(profile.stats.recentDailyAccuracy)})`
                                                        : 'No recent daily plays'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {comparisonProfileMatchups.map((stat) => (
                                            <div
                                                key={stat.id}
                                                className={`rounded-2xl border p-4 shadow-sm ${matchupToneClasses(stat.winner)}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-70">
                                                            {stat.label}
                                                        </div>
                                                        <div className="mt-2 text-lg font-semibold">
                                                            {stat.winner === 'VIEWER'
                                                                ? 'You'
                                                                : stat.winner === 'FRIEND'
                                                                    ? comparisonFriendName
                                                                    : 'Even'}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-full bg-white px-2.5 py-1 text-xs font-medium shadow-sm">
                                                        {stat.winner === 'TIE' ? 'Tie' : 'Edge'}
                                                    </div>
                                                </div>
                                                <p className="mt-3 text-sm leading-6">{stat.detail}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900">Round-by-round profile</h3>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    The stats page breaks progress out by round. This view mirrors that so you can see where each player is strongest.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 grid gap-4 lg:grid-cols-3">
                                            {comparisonRoundMatchups.map((matchup) => {
                                                const viewerRound = comparison.viewer.stats.roundStats.find((round) => round.round === matchup.round)
                                                const friendRound = comparison.friend.stats.roundStats.find((round) => round.round === matchup.round)
                                                const accent = roundAccentClasses(matchup.round)

                                                return (
                                                    <div key={matchup.round} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${accent.badge}`}>
                                                                {matchup.roundName}
                                                            </span>
                                                            <span className="text-sm font-medium text-slate-600">
                                                                {matchup.winner === 'TIE'
                                                                    ? 'Even'
                                                                    : matchup.winner === 'VIEWER'
                                                                        ? 'You lead'
                                                                        : `${comparisonFriendName} leads`}
                                                            </span>
                                                        </div>

                                                        {[
                                                            {
                                                                name: 'You',
                                                                stats: viewerRound,
                                                            },
                                                            {
                                                                name: comparisonFriendName,
                                                                stats: friendRound,
                                                            },
                                                        ].map((entry) => (
                                                            <div key={`${matchup.round}-${entry.name}`} className="mt-4">
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="font-medium text-slate-800">{entry.name}</span>
                                                                    <span className="text-slate-500">
                                                                        {formatPercent(entry.stats?.accuracy ?? 0)} · {(entry.stats?.totalPoints ?? 0).toLocaleString()} pts
                                                                    </span>
                                                                </div>
                                                                <div className="progress-bar mt-2">
                                                                    <div
                                                                        className={`progress-fill ${accent.progress}`}
                                                                        style={{ width: `${entry.stats?.accuracy ?? 0}%` }}
                                                                    />
                                                                </div>
                                                                <div className="mt-1 text-xs text-slate-500">
                                                                    {entry.stats?.correctAnswers ?? 0}/{entry.stats?.totalAnswered ?? 0} correct
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                        <h3 className="text-lg font-semibold text-slate-900">Key takeaways</h3>
                                        <div className="mt-4 space-y-3">
                                            {comparison.comparison.insights.map((insight) => (
                                                <div key={insight} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                                    {insight}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : comparison.comparison.headToHead.completedCount === 0 ? (
                                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                                    <h3 className="text-lg font-semibold text-slate-900">No direct challenge history yet</h3>
                                    <p className="mt-2 text-sm text-slate-600">
                                        Finish a friend challenge to unlock head-to-head scoring, recent results, and direct rivalry trends.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn-primary btn-sm mt-4"
                                        onClick={() => {
                                            activateSection('challenges')
                                            openChallengeComposer(comparison.friend.id)
                                        }}
                                    >
                                        Start a Challenge
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        {[
                                            {
                                                label: 'You',
                                                profile: comparison.viewer,
                                                wins: comparison.comparison.headToHead.viewerWins,
                                                averageScore: comparison.comparison.headToHead.viewerAverageScore,
                                                bestScore: comparison.comparison.headToHead.viewerBestScore,
                                            },
                                            {
                                                label: comparisonFriendName,
                                                profile: comparison.friend,
                                                wins: comparison.comparison.headToHead.friendWins,
                                                averageScore: comparison.comparison.headToHead.friendAverageScore,
                                                bestScore: comparison.comparison.headToHead.friendBestScore,
                                            },
                                        ].map(({ label, profile, wins, averageScore, bestScore }) => (
                                            <div key={`head-to-head-${profile.id}`} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar
                                                        displayName={profile.displayName || label}
                                                        selectedIcon={profile.selectedIcon}
                                                        avatarBackground={profile.avatarBackground}
                                                        size="md"
                                                    />
                                                    <div>
                                                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</div>
                                                        <div className="text-xl font-semibold text-slate-900">
                                                            {profile.displayName || label}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                                    <div className="rounded-2xl bg-slate-50 p-3">
                                                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Wins</div>
                                                        <div className="mt-1 text-2xl font-semibold text-slate-900">{wins}</div>
                                                    </div>
                                                    <div className="rounded-2xl bg-slate-50 p-3">
                                                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Avg score</div>
                                                        <div className="mt-1 text-2xl font-semibold text-slate-900">
                                                            {averageScore === null ? '—' : averageScore.toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-2xl bg-slate-50 p-3">
                                                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Best score</div>
                                                        <div className="mt-1 text-2xl font-semibold text-slate-900">
                                                            {bestScore === null ? '—' : bestScore.toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                            <h3 className="text-lg font-semibold text-slate-900">Head-to-head snapshot</h3>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Completed challenges</div>
                                                    <div className="mt-1 text-xl font-semibold text-slate-900">
                                                        {comparison.comparison.headToHead.completedCount}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Record</div>
                                                    <div className="mt-1 text-xl font-semibold text-slate-900">
                                                        {comparison.comparison.headToHead.viewerWins}-{comparison.comparison.headToHead.friendWins}
                                                        {comparison.comparison.headToHead.ties > 0
                                                            ? `-${comparison.comparison.headToHead.ties}`
                                                            : ''}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Average margin</div>
                                                    <div className="mt-1 text-xl font-semibold text-slate-900">
                                                        {comparison.comparison.headToHead.averageMargin ?? '—'}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Latest result</div>
                                                    <div className="mt-1 text-base font-semibold text-slate-900">
                                                        {comparison.comparison.headToHead.lastResult === 'VIEWER'
                                                            ? 'You won the latest match'
                                                            : comparison.comparison.headToHead.lastResult === 'FRIEND'
                                                                ? `${comparisonFriendName} won the latest match`
                                                                : 'Latest match was a tie'}
                                                    </div>
                                                    {comparison.comparison.headToHead.lastCompletedAt ? (
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            {formatCalendarDate(comparison.comparison.headToHead.lastCompletedAt)}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                            <h3 className="text-lg font-semibold text-slate-900">Head-to-head takeaways</h3>
                                            <div className="mt-4 space-y-3">
                                                {comparison.comparison.headToHeadInsights.map((insight) => (
                                                    <div key={insight} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                                        {insight}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                        <h3 className="text-lg font-semibold text-slate-900">Recent completed matches</h3>
                                        <div className="mt-4 space-y-3">
                                            {comparison.comparison.headToHead.recentMatches.map((match) => (
                                                <div key={`${match.completedAt}-${match.viewerScore}-${match.friendScore}`} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <div className="text-sm font-semibold text-slate-900">
                                                            {match.winner === 'VIEWER'
                                                                ? 'You won'
                                                                : match.winner === 'FRIEND'
                                                                    ? `${comparisonFriendName} won`
                                                                    : 'Tie game'}
                                                        </div>
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            {formatCalendarDate(match.completedAt)}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                                                        You {formatMatchScore(match.viewerScore)} · {comparisonFriendName} {formatMatchScore(match.friendScore)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                            Select a friend to compare total points, accuracy, daily form, round performance, and head-to-head results.
                        </div>
                    )}
                </section>
            )}

            {activeSection === 'settings' && (
                <section className="workspace-surface p-5 mt-0 md:p-6">
                    <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        {friendSettings.allowFriendRequests
                            ? 'Requests are open. People can send you an invite, but you still approve it manually.'
                            : 'Requests are paused. People with your code or link cannot send a new request right now.'}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Discovery</div>
                            <h3 className="mt-2 text-lg font-semibold text-slate-900">Profile visibility</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                Choose how much of your profile appears when another player opens your invite or finds you through friend discovery.
                            </p>
                            <label className="mt-4 grid gap-2">
                                <span className="text-sm font-medium text-slate-700">Visible profile mode</span>
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
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Requests</div>
                            <h3 className="mt-2 text-lg font-semibold text-slate-900">Incoming friend requests</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                Turning this off prevents new requests from being sent, even if someone already has your link or code. Existing friendships stay intact.
                            </p>
                            <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div>
                                    <div className="text-sm font-medium text-slate-800">Allow requests</div>
                                    <div className="mt-1 text-sm text-slate-500">
                                        {friendSettings.allowFriendRequests
                                            ? 'People can send you a request, but you still approve it manually.'
                                            : 'New requests are blocked until you turn this back on.'}
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={friendSettings.allowFriendRequests}
                                    onChange={(event) => void handleAllowRequestsChange(event.target.checked).catch(markError)}
                                    aria-label="Allow incoming friend requests"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Blocking</div>
                                <h3 className="mt-2 text-lg font-semibold text-slate-900">Blocked users</h3>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                    Blocked players cannot send requests or interact with you through the friends system until you remove the block.
                                </p>
                            </div>
                            <div className="inline-flex min-h-[3rem] min-w-[7.25rem] items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
                                {blockedUsers.length} blocked
                            </div>
                        </div>

                        {blockedUsers.length === 0 ? (
                            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                You have not blocked any users.
                            </div>
                        ) : (
                            <div className="mt-4 grid gap-3">
                                {blockedUsers.map((blockedUser) => (
                                    <div
                                        key={blockedUser.id}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
                                    >
                                        <div className="flex items-center gap-3">
                                            <UserAvatar
                                                displayName={blockedUser.displayName || blockedUser.email || ''}
                                                selectedIcon={blockedUser.selectedIcon}
                                                avatarBackground={blockedUser.avatarBackground}
                                                size="sm"
                                            />
                                            <div>
                                                <div className="font-medium text-slate-900">
                                                    {blockedUser.displayName || blockedUser.email || 'Unknown'}
                                                </div>
                                                <div className="text-sm text-slate-500">
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
                    </div>
                </section>
            )}

                </div>
            </div>

            {isRefreshInviteConfirmationOpen ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/45"
                        onClick={closeRefreshInviteConfirmation}
                        aria-label="Close refresh invite confirmation dialog"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="refresh-invite-confirmation-title"
                        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
                    >
                        <h3 id="refresh-invite-confirmation-title" className="text-lg font-semibold text-slate-900">
                            Refresh your invite?
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            This creates a new friend code and invite link. Anyone using the old invite will need the new one.
                        </p>
                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={closeRefreshInviteConfirmation}
                                disabled={inviteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => void confirmRefreshInvite()}
                                disabled={inviteLoading}
                            >
                                {inviteLoading ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {blockConfirmation ? (
                <div className="fixed inset-0 z-[62] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/45"
                        onClick={closeBlockConfirmation}
                        aria-label="Close block confirmation dialog"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="block-confirmation-title"
                        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
                    >
                        <h3 id="block-confirmation-title" className="text-lg font-semibold text-slate-900">
                            Block {blockConfirmation.displayName}?
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            This hides them from your friends workspace and stops requests while the block is active.
                        </p>
                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={closeBlockConfirmation}
                                disabled={processingBlockConfirmation}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => void confirmBlockAction()}
                                disabled={processingBlockConfirmation}
                            >
                                {processingBlockConfirmation ? 'Blocking...' : 'Block'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {removeFriendConfirmation ? (
                <div className="fixed inset-0 z-[63] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/45"
                        onClick={closeRemoveFriendConfirmation}
                        aria-label="Close remove friend confirmation dialog"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="remove-friend-confirmation-title"
                        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
                    >
                        <h3 id="remove-friend-confirmation-title" className="text-lg font-semibold text-slate-900">
                            Remove {removeFriendConfirmation.displayName}?
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            This removes the friendship and clears compare, challenge, and activity access between both accounts.
                        </p>
                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={closeRemoveFriendConfirmation}
                                disabled={processingRemoveFriendConfirmation}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary btn-sm"
                                onClick={() => void confirmRemoveFriendAction()}
                                disabled={processingRemoveFriendConfirmation}
                            >
                                {processingRemoveFriendConfirmation ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isMobileSectionMenuOpen ? (
                <div className="workspace-mobile-sheet">
                    <button
                        type="button"
                        className="workspace-mobile-sheet-backdrop"
                        onClick={() => setIsMobileSectionMenuOpen(false)}
                        aria-label="Close friends section menu"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="friends-mobile-sections-title"
                        className="workspace-mobile-sheet-panel"
                    >
                        <div className="workspace-mobile-sheet-header">
                            <h2 id="friends-mobile-sections-title" className="text-base font-semibold text-slate-900">
                                Sections
                            </h2>
                            <button
                                type="button"
                                className="workspace-mobile-sheet-close"
                                onClick={() => setIsMobileSectionMenuOpen(false)}
                                aria-label="Close friends section menu"
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="workspace-mobile-sheet-body">
                            {friendNavGroups.map((group) => (
                                <div key={group.label} className="workspace-nav-group">
                                    <div className="workspace-nav-label">{group.label}</div>
                                    <div className="space-y-2">
                                        {group.items.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                    setIsMobileSectionMenuOpen(false)
                                                    activateSection(item.id)
                                                }}
                                                className={`workspace-nav-button ${activeSection === item.id ? 'active' : ''}`}
                                                aria-current={activeSection === item.id ? 'page' : undefined}
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-semibold">{item.label}</div>
                                                    <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {item.badge ? <span className="workspace-nav-badge">{item.badge}</span> : null}
                                                    <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}

            {challengeComposer ? (
                <div className="fixed inset-0 z-[65] overflow-y-auto overscroll-y-contain p-4 sm:p-6">
                    <button
                        type="button"
                        className="absolute inset-0 bg-blue-950/55 backdrop-blur-[2px]"
                        onClick={closeChallengeComposer}
                        disabled={creatingChallenge}
                        aria-label="Close challenge composer"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="challenge-composer-title"
                        className="relative mx-auto my-4 max-h-[min(56rem,calc(100dvh-2rem))] w-full max-w-5xl overflow-y-auto overscroll-y-contain rounded-[2rem] border border-blue-300 bg-slate-50 p-5 pb-8 shadow-[0_24px_60px_rgba(15,23,42,0.28)] sm:p-6 sm:pb-10"
                    >
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 id="challenge-composer-title" className="text-xl font-semibold text-slate-900">
                                    Create Challenge
                                </h3>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                    Build a live Single Jeopardy board for a friend.
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

                        <div className="grid gap-5">
                            <label className="grid gap-2 text-sm">
                                <span className="font-medium text-slate-800">Friend</span>
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

                            <div className="rounded-[1.75rem] border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
                                <div className="grid gap-3 lg:grid-cols-2">
                                    <button
                                        type="button"
                                        className={`h-full rounded-[1.5rem] border p-4 text-left transition-all ${
                                            challengeComposer.categorySelection === 'RANDOM'
                                                ? 'border-blue-800 bg-blue-800 text-white shadow-md'
                                                : 'border-blue-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-slate-50'
                                        }`}
                                        onClick={() => setChallengeComposerSelection('RANDOM')}
                                        disabled={creatingChallenge}
                                    >
                                        <div className="flex h-full flex-col">
                                            <div className="flex items-center justify-between gap-4">
                                                <p className="text-base font-semibold">Random</p>
                                                <span className={`inline-flex min-w-[5.75rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                                    challengeComposer.categorySelection === 'RANDOM'
                                                        ? 'bg-amber-400 text-blue-950'
                                                        : 'bg-blue-50 text-blue-700'
                                                }`}>
                                                    One tap
                                                </span>
                                            </div>
                                            <div>
                                                <p className={`mt-1 text-sm leading-6 ${
                                                    challengeComposer.categorySelection === 'RANDOM'
                                                        ? 'text-blue-100'
                                                        : 'text-slate-600'
                                                }`}>
                                                    Fastest option. We build a fresh board and avoid the most recent matchup when possible.
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        className={`h-full rounded-[1.5rem] border p-4 text-left transition-all ${
                                            challengeComposer.categorySelection === 'CUSTOM'
                                                ? 'border-blue-900 bg-blue-900 text-white shadow-md'
                                                : 'border-blue-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-slate-50'
                                        }`}
                                        onClick={() => setChallengeComposerSelection('CUSTOM')}
                                        disabled={creatingChallenge}
                                    >
                                        <div className="flex h-full flex-col">
                                            <div className="flex items-center justify-between gap-4">
                                                <p className="text-base font-semibold">Custom</p>
                                                <span className={`inline-flex min-w-[5.75rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                                    challengeComposer.categorySelection === 'CUSTOM'
                                                        ? 'bg-amber-400 text-blue-950'
                                                        : 'bg-blue-50 text-blue-700'
                                                }`}>
                                                    Guided
                                                </span>
                                            </div>
                                            <div>
                                                <p className={`mt-1 text-sm leading-6 ${
                                                    challengeComposer.categorySelection === 'CUSTOM'
                                                        ? 'text-slate-200'
                                                        : 'text-slate-600'
                                                }`}>
                                                    Lock in the categories you care about. Each pick maps to one exact episode slice, then we fill the rest with complete single-episode boards.
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                <div className="mt-4 border-t border-blue-100 pt-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
                                        Categories in round
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {[1, 2, 3, 4, 5, 6].map((count) => (
                                            <button
                                                key={`challenge-category-count-${count}`}
                                                type="button"
                                                className={`inline-flex min-w-[2.75rem] items-center justify-center rounded-full border px-3 py-2 text-sm font-semibold transition ${
                                                    challengeComposer.categoryCount === count
                                                        ? 'border-blue-900 bg-blue-900 text-white shadow-sm'
                                                        : 'border-blue-100 bg-white text-blue-900 hover:border-blue-300 hover:bg-blue-50'
                                                }`}
                                                onClick={() => setChallengeCategoryCount(count)}
                                                disabled={creatingChallenge}
                                            >
                                                <span>{count}</span>
                                                {count === 1 ? <span className="ml-1 text-[11px] font-medium opacity-80">Quick</span> : null}
                                                {count === 3 ? <span className="ml-1 text-[11px] font-medium opacity-80">Recommended</span> : null}
                                                {count === 6 ? <span className="ml-1 text-[11px] font-medium opacity-80">Long</span> : null}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {challengeComposer.categorySelection === 'CUSTOM' ? (
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
                                    <div className="rounded-[1.75rem] border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                                Pick categories for this board
                                            </p>
                                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                                Lock in exact Single Jeopardy boards from one air date at a time.
                                            </p>
                                        </div>

                                        {categoryQuickPickOptions.length > 0 ? (
                                            <div className="mt-5 rounded-[1.5rem] border border-blue-200 bg-slate-50 p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                                                            Featured Boards
                                                        </p>
                                                        <p className="mt-1 text-sm text-slate-600">
                                                            Starts with categories you have never answered in practice or game, then falls back to the ones you have answered the least.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-50"
                                                        onClick={() => setIsFeaturedBoardsExpanded((current) => !current)}
                                                        disabled={creatingChallenge}
                                                    >
                                                        {isFeaturedBoardsExpanded ? 'Hide featured boards' : `Show featured boards (${categoryQuickPickOptions.length})`}
                                                    </button>
                                                </div>

                                                {isFeaturedBoardsExpanded ? (
                                                    <>
                                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                            {categoryQuickPickOptions.map((category) => {
                                                                const sameCategorySelected = challengeComposer.categoryChoices.some(
                                                                    (choice) => choice.categoryId === category.categoryId,
                                                                )
                                                                const atLimit = challengeComposer.categoryChoices.length >= challengeComposer.categoryCount
                                                                return (
                                                                    <button
                                                                        key={`challenge-quick-pick-${category.id}`}
                                                                        type="button"
                                                                        className="rounded-2xl border border-blue-200 bg-white p-4 text-left text-sm transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                                        onClick={() => toggleChallengeCategoryChoice(category)}
                                                                        disabled={creatingChallenge || (!sameCategorySelected && atLimit)}
                                                                    >
                                                                        <div className="flex items-start justify-between gap-3">
                                                                            <div className="min-w-0">
                                                                                <p className="truncate text-sm font-semibold text-slate-900">{category.name}</p>
                                                                                <p className="mt-1 text-xs text-slate-500">
                                                                                    {formatChallengeCategoryVariantMeta(category)} • {category._count?.questions || 0} clues
                                                                                </p>
                                                                            </div>
                                                                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                                                                {typeof category.answeredCount === 'number' && category.answeredCount === 0 ? 'Fresh' : 'Featured'}
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>

                                                        {customSelectionProgress?.remainingCount ? (
                                                            <button
                                                                type="button"
                                                                className="mt-3 inline-flex items-center rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-50"
                                                                onClick={addQuickPickCategoriesToChallenge}
                                                                disabled={creatingChallenge || categoryQuickPickOptions.length === 0}
                                                            >
                                                                Fill {Math.min(customSelectionProgress.remainingCount, categoryQuickPickOptions.length)} from featured boards
                                                            </button>
                                                        ) : null}
                                                    </>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-blue-200 bg-slate-50">
                                            <div className="border-b border-blue-200 px-4 py-3">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    Search results
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Search by category name to see exact Single Jeopardy board matches.
                                                </p>

                                                <label className="mt-3 grid gap-2 text-sm">
                                                    <span className="sr-only">Search categories</span>
                                                    <div className="relative">
                                                        <svg
                                                            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                                                        </svg>
                                                        <input
                                                            ref={customCategorySearchInputRef}
                                                            value={categorySearchQuery}
                                                            onChange={(event) => setCategorySearchQuery(event.target.value)}
                                                            onKeyDown={handleChallengeCategorySearchKeyDown}
                                                            className="form-input rounded-2xl border-blue-200 bg-white pl-11 pr-11 text-slate-900"
                                                            placeholder="Search category names"
                                                            disabled={creatingChallenge}
                                                        />
                                                        {categorySearchQuery ? (
                                                            <button
                                                                type="button"
                                                                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-blue-100 hover:text-blue-900"
                                                                onClick={() => setCategorySearchQuery('')}
                                                                disabled={creatingChallenge}
                                                                aria-label="Clear category search"
                                                            >
                                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </label>
                                            </div>

                                            <div className="max-h-[22rem] overflow-auto">
                                                {categorySearchLoading ? (
                                                    <p className="px-4 py-4 text-sm text-slate-600">Searching categories...</p>
                                                ) : categorySearchQuery.trim().length < 2 ? (
                                                    <p className="px-4 py-4 text-sm text-slate-600">
                                                        Search results will appear here after you type at least 2 characters.
                                                    </p>
                                                ) : categorySearchResults.length === 0 ? (
                                                    <p className="px-4 py-4 text-sm text-slate-600">
                                                        No playable categories matched that search.
                                                    </p>
                                                ) : (
                                                    categorySearchResults.map((category) => {
                                                        const selected = challengeComposer.categoryChoices.some((choice) => choice.id === category.id)
                                                        const sameCategorySelected = challengeComposer.categoryChoices.some(
                                                            (choice) => choice.categoryId === category.categoryId,
                                                        )
                                                        const atLimit = challengeComposer.categoryChoices.length >= challengeComposer.categoryCount
                                                        return (
                                                            <button
                                                                key={`challenge-search-result-${category.id}`}
                                                                type="button"
                                                                className="flex w-full items-center justify-between gap-3 border-b border-blue-100 px-4 py-3 text-left last:border-b-0 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                                                onClick={() => toggleChallengeCategoryChoice(category)}
                                                                disabled={creatingChallenge || (!sameCategorySelected && !selected && atLimit)}
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-semibold text-slate-900">
                                                                        {category.name}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        {formatChallengeCategoryVariantMeta(category)} • {category._count?.questions || 0} clues
                                                                        {typeof category.answeredCount === 'number'
                                                                            ? ` • ${category.answeredCount === 0 ? 'new to you' : `${category.answeredCount} answered`}`
                                                                            : ''}
                                                                    </p>
                                                                </div>
                                                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                                                    selected
                                                                        ? 'bg-amber-100 text-amber-800'
                                                                        : sameCategorySelected
                                                                            ? 'bg-slate-200 text-slate-700'
                                                                            : 'bg-blue-100 text-blue-800'
                                                                }`}>
                                                                    {selected ? 'Selected' : sameCategorySelected ? 'Swap in' : 'Add'}
                                                                </span>
                                                            </button>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[1.75rem] border border-blue-800 bg-blue-950 p-4 text-white shadow-lg sm:p-5 xl:sticky xl:top-0 xl:self-start">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold">Selected board</p>
                                                <p className="mt-1 text-sm leading-6 text-blue-100/85">
                                                    Your locked categories stay in order. Empty slots are finished automatically with other complete Single Jeopardy boards.
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                                                {challengeComposer.categoryChoices.length}/{challengeComposer.categoryCount}
                                            </span>
                                        </div>

                                        <div className="mt-4 grid gap-2">
                                            {Array.from({ length: challengeComposer.categoryCount }, (_, index) => {
                                                const choice = challengeComposer.categoryChoices[index]
                                                return choice ? (
                                                    <button
                                                        key={`challenge-slot-${choice.id}`}
                                                        type="button"
                                                        className="flex items-center justify-between rounded-2xl border border-blue-800 bg-blue-900/60 px-4 py-3 text-left transition hover:bg-blue-900"
                                                        onClick={() => toggleChallengeCategoryChoice(choice)}
                                                        disabled={creatingChallenge}
                                                    >
                                                        <div>
                                                            <p className="text-sm font-semibold text-white">
                                                                {choice.name}
                                                            </p>
                                                            <p className="mt-1 text-xs text-blue-100/75">
                                                                {formatChallengeCategoryVariantMeta(choice)}
                                                            </p>
                                                        </div>
                                                        <span className="text-xs font-semibold text-amber-200">
                                                            Remove
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <div
                                                        key={`challenge-empty-slot-${index}`}
                                                        className="rounded-2xl border border-dashed border-blue-800 bg-blue-900/30 px-4 py-3"
                                                    >
                                                        <p className="text-sm font-semibold text-slate-100">
                                                            Slot {index + 1}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-300">
                                                            {customSelectionProgress?.selectedCount
                                                                ? 'Filled with another full Single Jeopardy board on create'
                                                                : 'Pick at least one board to unlock automatic fill'}
                                                        </p>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        <div className="mt-4 rounded-2xl border border-blue-800 bg-blue-900/30 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/75">
                                                Create behavior
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-blue-50/90">
                                                {customSelectionProgress?.selectedCount
                                                    ? customSelectionProgress.isComplete
                                                        ? 'This board is fully defined. We will use your selected order exactly as shown.'
                                                        : `We will keep your ${customSelectionProgress.selectedCount} selected board${customSelectionProgress.selectedCount === 1 ? '' : 's'} and automatically fill the remaining ${customSelectionProgress.remainingCount} slot${customSelectionProgress.remainingCount === 1 ? '' : 's'} with other complete Single Jeopardy boards from specific air dates.`
                                                    : 'Select one board and the rest of the challenge will be completed automatically with episode-specific boards.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-[1.75rem] border border-blue-200 bg-white px-4 py-4 shadow-sm sm:px-5">
                                    <p className="text-sm font-semibold text-slate-900">Random board</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                        We will instantly build a {challengeComposer.categoryCount}-category board and keep it fresh by excluding the most recent categories for this matchup when possible.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                            <div>
                                <p className="text-sm font-medium text-slate-800">
                                    The challenge appears immediately in the Challenges tab for both players.
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Custom boards can be created as soon as one board variant is locked in.
                                </p>
                            </div>
                            {showChallengeComposerSubmitAction ? (
                                <button
                                    type="button"
                                    className="btn-gold"
                                    onClick={() => void submitChallengeComposer()}
                                    disabled={creatingChallenge || !canSubmitChallengeComposer}
                                >
                                    {creatingChallenge ? 'Creating...' : challengeComposerSubmitLabel}
                                </button>
                            ) : null}
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
