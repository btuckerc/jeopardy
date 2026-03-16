'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { ClientResumableGame } from './components/GameResumableList'
import type { GameConfig } from '@/types/game'
import toast from 'react-hot-toast'

// Dynamically import heavy components to reduce initial bundle size
const CustomCategoryPicker = dynamic(
    () => import('./components/CustomCategoryPicker'),
    { ssr: false }
)

const DateModeSection = dynamic(
    () => import('./components/DateModeSection'),
    { ssr: false }
)

const SeedLookupModal = dynamic(
    () => import('./components/SeedLookupModal'),
    { ssr: false }
)

const WarningModal = dynamic(
    () => import('./components/WarningModal'),
    { ssr: false }
)

const SpoilerWarningModal = dynamic(
    () => import('./components/SpoilerWarningModal'),
    { ssr: false }
)

// Regular imports for lighter components
import GameResumableList from './components/GameResumableList'
import GameCompletedList from './components/GameCompletedList'
import GameModeSelector from './components/GameModeSelector'
import QuickPlayCards from './components/QuickPlayCards'

interface Category {
    id: string
    name: string
    airDate?: Date
    isDoubleJeopardy: boolean
    _count?: {
        questions: number
    }
}

const KNOWLEDGE_CATEGORIES = [
    'GEOGRAPHY_AND_HISTORY',
    'ENTERTAINMENT',
    'ARTS_AND_LITERATURE',
    'SCIENCE_AND_NATURE',
    'SPORTS_AND_LEISURE',
    'GENERAL_KNOWLEDGE'
] as const

type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number]

// Props passed from server component - no fetching needed!
interface InitialUser {
    id: string
    email: string
    displayName: string | null
    selectedIcon: string | null
    avatarBackground: string | null
    role: string
}

interface InitialSpoilerSettings {
    enabled: boolean
    cutoffDate: string | null
}

interface GameHubClientProps {
    initialResumableGames: ClientResumableGame[]
    initialCompletedGames: ClientResumableGame[]
    initialUser: InitialUser | null
    initialSpoilerSettings: InitialSpoilerSettings | null
}

export default function GameHubClient({
    initialResumableGames,
    initialCompletedGames,
    initialUser,
    initialSpoilerSettings
}: GameHubClientProps) {
    const router = useRouter()
    // Use server-provided user data directly - no client fetch needed!
    const user = initialUser

    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'games' | 'new'>(() => (
        initialUser && (initialResumableGames.length + initialCompletedGames.length) === 0 ? 'new' : 'games'
    ))

    // Games tab state
    const [activeGamesTab, setActiveGamesTab] = useState<'inProgress' | 'completed'>('inProgress')

    // Resumable games state - start with server-provided data
    const [resumableGames, setResumableGames] = useState<ClientResumableGame[]>(initialResumableGames)
    const [completedGames, setCompletedGames] = useState<ClientResumableGame[]>(initialCompletedGames)
    const [loadingGames, setLoadingGames] = useState(false) // Start as false since we have initial data

    // New game configuration state
    const [selectedMode, setSelectedMode] = useState<'random' | 'knowledge' | 'custom' | 'date'>('random')
    const [selectedCategories, setSelectedCategories] = useState<KnowledgeCategory[]>([])
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null)
    const [customCategories, setCustomCategories] = useState<Category[]>([])
    const [rounds, setRounds] = useState({ single: true, double: true, final: true })
    const [finalCategoryMode, setFinalCategoryMode] = useState<'shuffle' | 'byDate' | 'specificCategory'>('byDate')
    const [finalCategoryId, _setFinalCategoryId] = useState<string | null>(null)
    const [isStartingGame, setIsStartingGame] = useState(false)

    // Warning modal state
    const [showWarningModal, setShowWarningModal] = useState(false)
    const [pendingGameConfig, setPendingGameConfig] = useState<GameConfig | null>(null)
    const [availableCategoriesForFill, setAvailableCategoriesForFill] = useState<Category[]>([])
    const [isLoadingFillCategories, setIsLoadingFillCategories] = useState(false)

    // Seed lookup state
    const [seedInput, setSeedInput] = useState('')
    const [seedLookupLoading, setSeedLookupLoading] = useState(false)
    const [seedLookupResult, setSeedLookupResult] = useState<{
        seed: string
        label: string
        mode: string
        rounds: string[]
        createdBy: string
    } | null>(null)
    const [seedLookupError, setSeedLookupError] = useState<string | null>(null)
    const [showSeedModal, setShowSeedModal] = useState(false)
    const [startingFromSeed, setStartingFromSeed] = useState(false)

    // Spoiler settings state - initialized from server data
    const [spoilerSettings, setSpoilerSettings] = useState<{
        enabled: boolean
        cutoffDate: Date | null
    } | null>(() => {
        if (!initialSpoilerSettings) return null
        return {
            enabled: initialSpoilerSettings.enabled,
            cutoffDate: initialSpoilerSettings.cutoffDate ? new Date(initialSpoilerSettings.cutoffDate) : null
        }
    })
    const [showSpoilerWarningModal, setShowSpoilerWarningModal] = useState(false)
    const [spoilerWarningConfig, setSpoilerWarningConfig] = useState<GameConfig | null>(null)
    const [spoilerWarningDate, setSpoilerWarningDate] = useState<string | null>(null)
    const [updatingSpoilerDate, setUpdatingSpoilerDate] = useState(false)

    // No fetch needed - spoiler settings provided by server!

    // Track if this is the initial mount
    const isInitialMount = useRef(true)

    // Refresh games after ending a game or creating a new game
    const refreshGames = useCallback(async () => {
        if (!user?.id) return

        setLoadingGames(true)
        try {
            // Fetch both in parallel for snappy UX
            const [resumableRes, completedRes] = await Promise.all([
                fetch('/api/games/resumable'),
                fetch('/api/games/completed')
            ])

            if (resumableRes.ok) {
                const data = await resumableRes.json()
                setResumableGames(data.games || [])
            }

            if (completedRes.ok) {
                const data = await completedRes.json()
                setCompletedGames(data.games || [])
            }
        } catch (error) {
            console.error('Error fetching games:', error)
        } finally {
            setLoadingGames(false)
        }
    }, [user?.id])

    // Refresh games when component mounts and when window regains focus
    useEffect(() => {
        // Skip initial mount - we already have server-provided initial data
        // This prevents the "Loading your games" flash when the page first loads
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }

        if (user?.id) {
            refreshGames()
        }
    }, [user?.id, refreshGames])

    // Refresh games when window regains focus (e.g., after playing a game)
    useEffect(() => {
        const handleFocus = () => {
            if (user?.id) {
                refreshGames()
            }
        }

        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [user?.id, refreshGames])

    useEffect(() => {
        if (user && resumableGames.length === 0 && completedGames.length === 0) {
            setActiveWorkspaceTab('new')
        }
    }, [completedGames.length, resumableGames.length, user])

    const handleDateChange = (date: Date | null) => {
        setSelectedDateObj(date)
        setSelectedDate(date ? date.toISOString().split('T')[0] : '')
    }

    // Update final category mode when switching to/from "By Air Date" mode
    useEffect(() => {
        if (selectedMode === 'date') {
            setFinalCategoryMode('byDate')
        } else {
            if (finalCategoryMode === 'byDate') {
                setFinalCategoryMode('shuffle')
            }
        }
    }, [selectedMode, finalCategoryMode])


    const checkIfWarningNeeded = async (config: GameConfig, mode: string): Promise<boolean> => {
        const selectedRounds = [rounds.single, rounds.double].filter(Boolean).length
        const needsFullBoards = selectedRounds > 0

        if (!needsFullBoards) return false

        if (mode === 'custom') {
            return customCategories.length < 5
        } else if (mode === 'knowledge') {
            try {
                const params = new URLSearchParams()
                params.append('mode', 'knowledge')
                params.append('categories', selectedCategories.join(','))
                params.append('round', 'SINGLE')

                const response = await fetch(`/api/categories/game?${params.toString()}`)
                if (!response.ok) return true
                const data = await response.json()
                return !Array.isArray(data) || data.length < 5
            } catch {
                return true
            }
        }
        return false
    }

    const fetchAvailableCategoriesForFill = async () => {
        setIsLoadingFillCategories(true)
        try {
            const response = await fetch('/api/categories')
            if (!response.ok) throw new Error('Failed to fetch categories')
            const data = await response.json()
            const selectedIds = new Set(customCategories.map(c => c.id))
            const available = data.filter((cat: Category) =>
                !selectedIds.has(cat.id) &&
                cat._count?.questions &&
                cat._count.questions >= 5 &&
                !cat.isDoubleJeopardy
            )
            setAvailableCategoriesForFill(available)
        } catch (error) {
            console.error('Error fetching categories:', error)
            setAvailableCategoriesForFill([])
        } finally {
            setIsLoadingFillCategories(false)
        }
    }

    // Check if the game configuration would violate spoiler settings
    const checkSpoilerConflict = (config: GameConfig): { hasConflict: boolean; conflictDate: string | null } => {
        // If user doesn't have spoiler protection enabled, no conflict
        if (!spoilerSettings?.enabled || !spoilerSettings.cutoffDate) {
            return { hasConflict: false, conflictDate: null }
        }

        const cutoffDate = spoilerSettings.cutoffDate

        // For date mode, check if the selected episode is on or after the cutoff
        if (config.mode === 'date' && config.date) {
            const episodeDate = new Date(config.date)
            if (episodeDate >= cutoffDate) {
                return {
                    hasConflict: true,
                    conflictDate: episodeDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })
                }
            }
        }

        // For random/knowledge/custom modes, the game may draw from any episode
        // We warn conservatively that it might include newer episodes
        if (config.mode === 'random' || config.mode === 'knowledge' || config.mode === 'custom') {
            // These modes will respect the user's spoiler settings automatically,
            // so no warning is needed - the backend will filter appropriately
            return { hasConflict: false, conflictDate: null }
        }

        return { hasConflict: false, conflictDate: null }
    }

    const handleStartGame = async () => {
        if (!user) {
            router.push('/auth/signin')
            return
        }

        let gameConfig: GameConfig

        switch (selectedMode) {
            case 'random':
                gameConfig = { mode: 'random' }
                break
            case 'knowledge':
                if (selectedCategories.length === 0) {
                    toast.error('Please select at least one knowledge category')
                    return
                }
                gameConfig = {
                    mode: 'knowledge',
                    categories: selectedCategories
                }
                break
            case 'custom':
                if (customCategories.length === 0) {
                    toast.error('Please select at least one category')
                    return
                }
                gameConfig = {
                    mode: 'custom',
                    categoryIds: customCategories.map(c => c.id)
                }
                break
            case 'date':
                if (!selectedDate) {
                    toast.error('Please select a date')
                    return
                }
                gameConfig = {
                    mode: 'date',
                    date: selectedDate
                }
                break
        }

        gameConfig.rounds = rounds
        if (rounds.final) {
            gameConfig.finalCategoryMode = finalCategoryMode
            if (finalCategoryMode === 'specificCategory' && finalCategoryId) {
                gameConfig.finalCategoryId = finalCategoryId
            }
        }

        if (!rounds.single && !rounds.double && !rounds.final) {
            toast.error('Please select at least one round')
            return
        }

        // Check for spoiler conflicts first
        const spoilerCheck = checkSpoilerConflict(gameConfig)
        if (spoilerCheck.hasConflict) {
            setSpoilerWarningConfig(gameConfig)
            setSpoilerWarningDate(spoilerCheck.conflictDate)
            setShowSpoilerWarningModal(true)
            return
        }

        const needsWarning = await checkIfWarningNeeded(gameConfig, selectedMode)
        if (needsWarning) {
            setPendingGameConfig(gameConfig)
            if (selectedMode === 'custom') {
                await fetchAvailableCategoriesForFill()
            }
            setShowWarningModal(true)
            return
        }

        await createAndStartGame(gameConfig)
    }

    const createAndStartGame = async (gameConfig: GameConfig) => {
        setIsStartingGame(true)
        try {
            // Create game on server
            const response = await fetch('/api/games/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gameConfig)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to create game')
            }

            const game = await response.json()

            // Navigate to the game board with the game ID
            router.push(`/game/${game.id}`)
        } catch (error) {
            console.error('Error creating game:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to create game')
        } finally {
            setIsStartingGame(false)
        }
    }

    const handleConfirmStartGame = () => {
        if (!pendingGameConfig) return

        const updatedConfig = { ...pendingGameConfig }
        if (selectedMode === 'knowledge') {
            updatedConfig.categories = selectedCategories
        } else if (selectedMode === 'custom') {
            updatedConfig.categoryIds = customCategories.map(c => c.id)
        }

        setShowWarningModal(false)
        setPendingGameConfig(null)
        createAndStartGame(updatedConfig)
    }

    const handleAddRandomCategories = () => {
        if (selectedMode !== 'custom' || availableCategoriesForFill.length === 0) return

        const needed = 5 - customCategories.length
        const randomCategories = availableCategoriesForFill
            .sort(() => Math.random() - 0.5)
            .slice(0, needed)

        setCustomCategories([...customCategories, ...randomCategories])
        setShowWarningModal(false)
        setPendingGameConfig(null)
    }

    const handleAddSelectedCategory = (category: Category) => {
        if (customCategories.length >= 5) return
        if (customCategories.some(c => c.id === category.id)) return
        const updated = [...customCategories, category]
        setCustomCategories(updated)

        if (updated.length >= 5) {
            setShowWarningModal(false)
            setPendingGameConfig(null)
        }
    }

    const handleEndGame = async (gameId: string) => {
        if (!confirm('End this game? You won\'t be able to resume it, but your answered questions will still count toward your stats.')) {
            return
        }

        try {
            const response = await fetch(`/api/games/${gameId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                // Refresh the list
                await refreshGames()
            }
        } catch (error) {
            console.error('Error ending game:', error)
        }
    }

    // Seed lookup functions
    const handleSeedLookup = async () => {
        if (!seedInput.trim()) return

        setSeedLookupLoading(true)
        setSeedLookupError(null)
        setSeedLookupResult(null)

        try {
            const response = await fetch(`/api/games/by-seed/${encodeURIComponent(seedInput.trim())}`)

            if (response.ok) {
                const data = await response.json()
                setSeedLookupResult(data)
                setShowSeedModal(true)
            } else if (response.status === 404) {
                setSeedLookupError('No game found with this seed code')
            } else {
                setSeedLookupError('Failed to look up seed')
            }
        } catch (error) {
            console.error('Error looking up seed:', error)
            setSeedLookupError('Error looking up seed')
        } finally {
            setSeedLookupLoading(false)
        }
    }

    const handleStartFromSeed = async () => {
        if (!seedLookupResult) return

        setStartingFromSeed(true)

        try {
            const response = await fetch(`/api/games/by-seed/${encodeURIComponent(seedLookupResult.seed)}`, {
                method: 'POST'
            })

            if (response.ok) {
                const data = await response.json()
                router.push(`/game/${data.id}`)
            } else {
                const error = await response.json()
                setSeedLookupError(error.error || 'Failed to start game')
            }
        } catch (error) {
            console.error('Error starting game from seed:', error)
            setSeedLookupError('Error starting game')
        } finally {
            setStartingFromSeed(false)
        }
    }

    const _handleCopySeed = (seed: string) => {
        navigator.clipboard.writeText(seed)
        // Could add a toast notification here
    }

    // Handle proceeding with game despite spoiler warning
    const handleProceedWithSpoiler = async () => {
        if (!spoilerWarningConfig) return

        // Add override flag to ignore spoiler cutoff for this game
        const configWithOverride = {
            ...spoilerWarningConfig,
            ignoreSpoilerCutoff: true
        }

        setShowSpoilerWarningModal(false)
        setSpoilerWarningConfig(null)
        setSpoilerWarningDate(null)

        // Continue with the normal flow (check for category warnings, then create)
        const needsWarning = await checkIfWarningNeeded(configWithOverride, selectedMode)
        if (needsWarning) {
            setPendingGameConfig(configWithOverride)
            if (selectedMode === 'custom') {
                await fetchAvailableCategoriesForFill()
            }
            setShowWarningModal(true)
            return
        }

        await createAndStartGame(configWithOverride)
    }

    // Handle updating spoiler date from the warning modal
    const handleUpdateSpoilerDate = async (newDate: Date) => {
        // Don't require spoilerWarningConfig - allow updating date from the inline picker too
        setUpdatingSpoilerDate(true)
        try {
            console.log('Updating spoiler date to:', newDate.toISOString())

            // Update the user's spoiler settings - also ensure spoiler protection is enabled
            const response = await fetch('/api/user/spoiler-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    spoilerBlockDate: newDate.toISOString(),
                    spoilerBlockEnabled: true
                })
            })

            console.log('Response status:', response.status)

            if (!response.ok) {
                const errorText = await response.text()
                console.error('Spoiler settings update failed. Status:', response.status, 'Body:', errorText)
                let errorMessage = 'Failed to update spoiler settings'
                try {
                    const errorData = JSON.parse(errorText)
                    errorMessage = errorData.error || errorMessage
                } catch {
                    // Not JSON, use default message
                }
                throw new Error(errorMessage)
            }

            const responseData = await response.json()
            console.log('Spoiler settings updated successfully:', responseData)

            // Update local state
            setSpoilerSettings({
                enabled: true,
                cutoffDate: newDate
            })

            // Close the modal and re-attempt starting the game if we have a config
            setShowSpoilerWarningModal(false)
            const savedConfig = spoilerWarningConfig
            setSpoilerWarningConfig(null)
            setSpoilerWarningDate(null)

            // Only proceed with game creation if we have a pending config
            if (savedConfig) {
                // Re-check with updated settings (should pass now)
                const needsWarning = await checkIfWarningNeeded(savedConfig, selectedMode)
                if (needsWarning) {
                    setPendingGameConfig(savedConfig)
                    if (selectedMode === 'custom') {
                        await fetchAvailableCategoriesForFill()
                    }
                    setShowWarningModal(true)
                    return
                }

                await createAndStartGame(savedConfig)
            }
        } catch (error) {
            console.error('Error updating spoiler settings:', error)
            toast.error('Failed to update spoiler settings. Please try again.')
        } finally {
            setUpdatingSpoilerDate(false)
        }
    }

    const workspaceTabs = [
        {
            id: 'games' as const,
            label: 'Your Games',
            description: user
                ? 'Resume active boards or revisit completed runs.'
                : 'Sign in to save and resume your boards.',
            badge: user && (resumableGames.length + completedGames.length) > 0
                ? (resumableGames.length + completedGames.length).toString()
                : undefined,
        },
        {
            id: 'new' as const,
            label: 'Start New Game',
            description: 'Build a board or jump in with a shared code.',
        },
    ]
    const selectedRoundLabels = [
        rounds.single ? 'Single Jeopardy' : null,
        rounds.double ? 'Double Jeopardy' : null,
        rounds.final ? 'Final Jeopardy' : null,
    ].filter((value): value is string => Boolean(value))
    const hasSavedGames = resumableGames.length + completedGames.length > 0
    const startGameDisabled = (
        isStartingGame ||
        (selectedMode === 'knowledge' && selectedCategories.length === 0) ||
        (selectedMode === 'custom' && customCategories.length === 0) ||
        (selectedMode === 'date' && !selectedDate) ||
        (!rounds.single && !rounds.double && !rounds.final)
    )
    const selectedModeSummary = (
        selectedMode === 'date'
            ? (selectedDateObj
                ? selectedDateObj.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                })
                : 'Pick an air date')
            : selectedMode === 'knowledge'
                ? `${selectedCategories.length || 'No'} knowledge area${selectedCategories.length === 1 ? '' : 's'}`
                : selectedMode === 'custom'
                    ? `${customCategories.length || 'No'} custom categor${customCategories.length === 1 ? 'y' : 'ies'}`
                    : 'Random board'
    )
    const finalRoundSummary = rounds.final
        ? (finalCategoryMode === 'byDate' ? 'Match air date' : 'Random category')
        : 'Final Jeopardy off'


    return (
        <div className="workspace-page" style={{ scrollbarGutter: 'stable' }}>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-white via-blue-50 to-slate-50 p-6 shadow-sm sm:p-7">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Play Game</h1>
                            <p className="mt-1 max-w-3xl text-sm text-gray-600">
                                Jump into a fast preset first, then switch into saved games or a custom board setup below.
                            </p>
                        </div>
                        <div className="inline-flex rounded-full border border-blue-200 bg-white/90 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
                            Quick selections
                        </div>
                    </div>

                    <div className="mt-5">
                        <QuickPlayCards
                            onGameCreated={() => {
                                refreshGames()
                            }}
                        />
                    </div>
                </section>

                <section className="workspace-surface overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-5 md:px-6">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="min-w-0">
                                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                                        Next move
                                    </div>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                                        Start a new board or jump back into one you already opened
                                    </h2>
                                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                                        New game setup stays one tap away, and players without any saved boards land there automatically.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    {hasSavedGames && activeWorkspaceTab !== 'new' ? (
                                        <button
                                            type="button"
                                            className="btn-primary btn-sm"
                                            onClick={() => setActiveWorkspaceTab('new')}
                                        >
                                            Start New Game
                                        </button>
                                    ) : null}
                                    {hasSavedGames && activeWorkspaceTab === 'new' ? (
                                        <button
                                            type="button"
                                            className="btn-outline btn-sm"
                                            onClick={() => setActiveWorkspaceTab('games')}
                                        >
                                            View Existing Games
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <div
                                role="tablist"
                                aria-label="Game workspace sections"
                                className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:min-w-[30rem]"
                            >
                                {workspaceTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        id={`game-workspace-tab-${tab.id}`}
                                        aria-controls={`game-workspace-panel-${tab.id}`}
                                        aria-selected={activeWorkspaceTab === tab.id}
                                        onClick={() => setActiveWorkspaceTab(tab.id)}
                                        className={`flex min-h-[4.5rem] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                                            activeWorkspaceTab === tab.id
                                                ? 'border-blue-200 bg-blue-50 text-blue-900 shadow-sm'
                                                : tab.id === 'new'
                                                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 hover:border-emerald-300 hover:bg-white'
                                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="font-semibold">{tab.label}</div>
                                            <div className={`mt-1 text-xs ${
                                                activeWorkspaceTab === tab.id
                                                    ? 'text-blue-700'
                                                    : tab.id === 'new'
                                                        ? 'text-emerald-800'
                                                        : 'text-slate-500'
                                            }`}>
                                                {tab.description}
                                            </div>
                                        </div>
                                        {tab.badge ? (
                                            <span className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                activeWorkspaceTab === tab.id ? 'bg-white text-blue-700' : 'bg-white text-slate-600'
                                            }`}>
                                                {tab.badge}
                                            </span>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-5 md:p-6">
                        {activeWorkspaceTab === 'games' ? (
                            <div
                                role="tabpanel"
                                id="game-workspace-panel-games"
                                aria-labelledby="game-workspace-tab-games"
                                className="space-y-5"
                            >
                                {!user ? (
                                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                                            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-semibold text-slate-900">Sign in to keep your games in motion</h3>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Save unfinished boards, track completed runs, and pick back up without rebuilding the setup.
                                        </p>
                                        <Link href="/sign-in?redirect_url=/game" className="btn-primary mt-5 inline-flex items-center gap-2">
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                            </svg>
                                            Sign In to Play
                                        </Link>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Saved boards</div>
                                                <h3 className="mt-2 text-lg font-semibold text-slate-900">Resume active runs or review finished ones</h3>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    Keep current games close and switch to completed boards only when you need the archive.
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveGamesTab('inProgress')}
                                                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                                        activeGamesTab === 'inProgress'
                                                            ? 'bg-blue-50 text-blue-900'
                                                            : 'text-slate-600 hover:text-slate-900'
                                                    }`}
                                                >
                                                    In Progress
                                                    {resumableGames.length > 0 ? (
                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                            activeGamesTab === 'inProgress'
                                                                ? 'bg-white text-blue-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {resumableGames.length}
                                                        </span>
                                                    ) : null}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveGamesTab('completed')}
                                                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                                                        activeGamesTab === 'completed'
                                                            ? 'bg-blue-50 text-blue-900'
                                                            : 'text-slate-600 hover:text-slate-900'
                                                    }`}
                                                >
                                                    Completed
                                                    {completedGames.length > 0 ? (
                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                            activeGamesTab === 'completed'
                                                                ? 'bg-white text-blue-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {completedGames.length}
                                                        </span>
                                                    ) : null}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="w-full overflow-hidden" style={{ contain: 'inline-size' }}>
                                            {activeGamesTab === 'inProgress' ? (
                                                <GameResumableList
                                                    games={resumableGames}
                                                    loading={loadingGames}
                                                    onEndGame={handleEndGame}
                                                />
                                            ) : (
                                                <GameCompletedList
                                                    games={completedGames}
                                                    loading={loadingGames}
                                                />
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div
                                role="tabpanel"
                                id="game-workspace-panel-new"
                                aria-labelledby="game-workspace-tab-new"
                            >
                                {!user ? (
                                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                            <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-semibold text-slate-900">Sign in to start a new board</h3>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Custom games and shared codes both start here once your account is active.
                                        </p>
                                        <Link href="/sign-in?redirect_url=/game" className="btn-primary mt-5 inline-flex items-center gap-2">
                                            Sign In to Continue
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.86fr)]">
                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                                                        New board setup
                                                    </div>
                                                    <h3 className="mt-2 text-xl font-semibold text-slate-900">Choose how you want to play</h3>
                                                    <p className="mt-1 text-sm text-slate-600">
                                                        The builder stays on one side while shared-game entry and setup context stay visible alongside it.
                                                    </p>
                                                </div>
                                                <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                                                    Customizable
                                                </div>
                                            </div>

                                            <div className="mt-6 space-y-6">
                                                <GameModeSelector
                                                    selectedMode={selectedMode}
                                                    onModeChange={setSelectedMode}
                                                />

                                                {selectedMode === 'knowledge' && (
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                        <label className="mb-3 block text-sm font-medium text-gray-700">Select Knowledge Categories</label>
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {KNOWLEDGE_CATEGORIES.map((category) => (
                                                                <label key={category} className="flex cursor-pointer items-center space-x-2 rounded-xl bg-white px-3 py-2 text-gray-900 shadow-sm">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedCategories.includes(category)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedCategories([...selectedCategories, category])
                                                                            } else {
                                                                                setSelectedCategories(selectedCategories.filter(c => c !== category))
                                                                            }
                                                                        }}
                                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    <span className="text-sm">{category.replace(/_/g, ' ')}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedMode === 'custom' && (
                                                    <CustomCategoryPicker
                                                        selectedCategories={customCategories}
                                                        onCategoriesChange={setCustomCategories}
                                                        maxCategories={5}
                                                    />
                                                )}

                                                {selectedMode === 'date' && (
                                                    <DateModeSection
                                                        selectedDate={selectedDate}
                                                        selectedDateObj={selectedDateObj}
                                                        onDateChange={handleDateChange}
                                                    />
                                                )}

                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <label className="mb-3 block text-sm font-medium text-gray-700">Rounds</label>
                                                    <div className="flex flex-wrap gap-3">
                                                        <label className="flex cursor-pointer items-center space-x-2 rounded-xl bg-white px-3 py-2 text-gray-900 shadow-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={rounds.single}
                                                                onChange={(e) => setRounds({ ...rounds, single: e.target.checked })}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm">Single Jeopardy</span>
                                                        </label>
                                                        <label className="flex cursor-pointer items-center space-x-2 rounded-xl bg-white px-3 py-2 text-gray-900 shadow-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={rounds.double}
                                                                onChange={(e) => setRounds({ ...rounds, double: e.target.checked })}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm">Double Jeopardy</span>
                                                        </label>
                                                        <label className="flex cursor-pointer items-center space-x-2 rounded-xl bg-white px-3 py-2 text-gray-900 shadow-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={rounds.final}
                                                                onChange={(e) => setRounds({ ...rounds, final: e.target.checked })}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm">Final Jeopardy</span>
                                                        </label>
                                                    </div>
                                                </div>

                                                {rounds.final && (
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                        <label className="mb-3 block text-sm font-medium text-gray-700">Final Jeopardy Category</label>
                                                        <div className="space-y-2">
                                                            <label className="flex cursor-pointer items-center space-x-2 rounded-xl bg-white px-3 py-2 text-gray-900 shadow-sm">
                                                                <input
                                                                    type="radio"
                                                                    name="finalCategoryMode"
                                                                    checked={finalCategoryMode === 'shuffle'}
                                                                    onChange={() => setFinalCategoryMode('shuffle')}
                                                                    className="border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-sm">Random category</span>
                                                            </label>
                                                            {selectedMode === 'date' && (
                                                                <label className="flex cursor-pointer items-center space-x-2 rounded-xl bg-white px-3 py-2 text-gray-900 shadow-sm">
                                                                    <input
                                                                        type="radio"
                                                                        name="finalCategoryMode"
                                                                        checked={finalCategoryMode === 'byDate'}
                                                                        onChange={() => setFinalCategoryMode('byDate')}
                                                                        className="border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    <span className="text-sm">Match air date</span>
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex justify-end border-t border-slate-200 pt-4">
                                                    <button
                                                        onClick={handleStartGame}
                                                        disabled={startGameDisabled}
                                                        className={`btn-primary px-8 py-3 text-lg ${isStartingGame ? 'cursor-wait opacity-50' : ''}`}
                                                    >
                                                        {isStartingGame ? (
                                                            <>
                                                                <span className="spinner mr-2"></span>
                                                                Starting...
                                                            </>
                                                        ) : (
                                                            'Start Game'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-blue-50 to-slate-50 p-5 shadow-sm">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                        </svg>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Have a game code?</div>
                                                        <h3 className="mt-2 text-xl font-semibold text-slate-900">Play a shared board</h3>
                                                        <p className="mt-1 text-sm text-slate-600">
                                                            Enter a seed to preview the shared setup before you start the board.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-5 space-y-3">
                                                    <label className="grid gap-1.5">
                                                        <span className="text-sm font-medium text-slate-800">Game code</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Enter seed..."
                                                            value={seedInput}
                                                            onChange={(e) => {
                                                                setSeedInput(e.target.value)
                                                                setSeedLookupError(null)
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && seedInput.trim()) {
                                                                    handleSeedLookup()
                                                                }
                                                            }}
                                                            className="form-input bg-white text-gray-900 placeholder:text-gray-500"
                                                        />
                                                    </label>

                                                    <button
                                                        onClick={handleSeedLookup}
                                                        disabled={!seedInput.trim() || seedLookupLoading}
                                                        className={`btn-primary w-full justify-center ${!seedInput.trim() || seedLookupLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                                                    >
                                                        {seedLookupLoading ? 'Looking up...' : 'Preview Shared Game'}
                                                    </button>

                                                    {seedLookupError ? (
                                                        <p className="text-sm text-red-600">{seedLookupError}</p>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h3 className="text-lg font-semibold text-slate-900">Setup snapshot</h3>
                                                        <p className="mt-1 text-sm text-slate-600">
                                                            Keep the current build visible while you adjust the board.
                                                        </p>
                                                    </div>
                                                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                                        Live
                                                    </div>
                                                </div>

                                                <div className="mt-4 space-y-3">
                                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mode</div>
                                                        <div className="mt-1 text-sm font-medium text-slate-900">
                                                            {selectedMode === 'date'
                                                                ? 'By Air Date'
                                                                : selectedMode === 'knowledge'
                                                                    ? 'Knowledge Areas'
                                                                    : selectedMode === 'custom'
                                                                        ? 'Custom'
                                                                        : 'Random'}
                                                        </div>
                                                        <div className="mt-1 text-sm text-slate-600">{selectedModeSummary}</div>
                                                    </div>

                                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rounds</div>
                                                        <div className="mt-1 text-sm font-medium text-slate-900">
                                                            {selectedRoundLabels.length > 0 ? selectedRoundLabels.join(' • ') : 'Choose at least one round'}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Final Jeopardy</div>
                                                        <div className="mt-1 text-sm font-medium text-slate-900">{finalRoundSummary}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Seed Preview Modal */}
            <SeedLookupModal
                isOpen={showSeedModal}
                result={seedLookupResult}
                error={seedLookupError}
                isLoading={seedLookupLoading}
                isStarting={startingFromSeed}
                onClose={() => {
                                    setShowSeedModal(false)
                                    setSeedLookupResult(null)
                                }}
                onStart={handleStartFromSeed}
            />

            {/* Warning Modal */}
            <WarningModal
                isOpen={showWarningModal}
                mode={selectedMode === 'custom' ? 'custom' : 'knowledge'}
                customCategories={customCategories}
                knowledgeCategoriesCount={selectedCategories.length}
                availableCategoriesForFill={availableCategoriesForFill}
                isLoadingFillCategories={isLoadingFillCategories}
                onClose={() => {
                                    setShowWarningModal(false)
                                    setPendingGameConfig(null)
                                }}
                onConfirm={handleConfirmStartGame}
                onAddRandom={handleAddRandomCategories}
                onAddCategory={handleAddSelectedCategory}
            />

            {/* Spoiler Warning Modal */}
            <SpoilerWarningModal
                isOpen={showSpoilerWarningModal}
                spoilerSettings={spoilerSettings}
                conflictDate={spoilerWarningDate}
                gameConfigDate={spoilerWarningConfig?.date}
                updatingSpoilerDate={updatingSpoilerDate}
                onClose={() => {
                                    setShowSpoilerWarningModal(false)
                                    setSpoilerWarningConfig(null)
                                    setSpoilerWarningDate(null)
                                }}
                onProceed={handleProceedWithSpoiler}
                onUpdateSpoilerDate={handleUpdateSpoilerDate}
            />
        </div>
    )
}
