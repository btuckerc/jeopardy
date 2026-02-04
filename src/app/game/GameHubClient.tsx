'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { ClientResumableGame } from './components/GameResumableList'
import type { GameConfig } from '@/types/game'

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

    // Refresh games when component mounts and when window regains focus
    useEffect(() => {
        if (user?.id) {
            refreshGames()
        }
    }, [user?.id])

    // Refresh games when window regains focus (e.g., after playing a game)
    useEffect(() => {
        const handleFocus = () => {
            if (user?.id) {
                refreshGames()
            }
        }

        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [user?.id])

    // Refresh games after ending a game or creating a new game
    const refreshGames = async () => {
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
    }

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
                    alert('Please select at least one knowledge category')
                    return
                }
                gameConfig = {
                    mode: 'knowledge',
                    categories: selectedCategories
                }
                break
            case 'custom':
                if (customCategories.length === 0) {
                    alert('Please select at least one category')
                    return
                }
                gameConfig = {
                    mode: 'custom',
                    categoryIds: customCategories.map(c => c.id)
                }
                break
            case 'date':
                if (!selectedDate) {
                    alert('Please select a date')
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
            alert('Please select at least one round')
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
            alert(error instanceof Error ? error.message : 'Failed to create game')
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
            alert('Failed to update spoiler settings. Please try again.')
        } finally {
            setUpdatingSpoilerDate(false)
        }
    }


    return (
        <div className="min-h-screen w-full bg-gray-100 py-8 px-4" style={{ scrollbarGutter: 'stable' }}>
            <div className="w-full max-w-4xl mx-auto">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Play Game</h1>
                    <p className="text-gray-600">Start a new game or continue where you left off.</p>
                </div>

                {/* Quick Play Cards */}
                <div className="mb-8">
                    <QuickPlayCards 
                        user={user} 
                        onGameCreated={() => {
                            // Refresh games list when a new game is created
                            refreshGames()
                        }} 
                    />
                </div>

                {/* Resumable Games Section */}
                {!user ? (
                    // Show sign-in prompt if not authenticated
                    <div className="mb-8">
                        <div className="card p-6 text-center bg-gray-50 border-dashed">
                            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to Play</h2>
                            <p className="text-gray-600 mb-4">Sign in to start a new game or resume where you left off.</p>
                            <Link href="/sign-in?redirect_url=/game" className="btn-primary inline-flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                                Sign In to Play
                            </Link>
                        </div>
                    </div>
                ) : (
                    // Show games section if authenticated
                    <div className="w-full mb-8">
                        {/* Header with tabs */}
                        <div className="flex items-center justify-between mb-4 w-full">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Your Games
                            </h2>
                            
                            {/* Tabs */}
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => setActiveGamesTab('inProgress')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        activeGamesTab === 'inProgress'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    In Progress
                                    {resumableGames.length > 0 && (
                                        <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                                            activeGamesTab === 'inProgress'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {resumableGames.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveGamesTab('completed')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        activeGamesTab === 'completed'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Completed
                                    {completedGames.length > 0 && (
                                        <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                                            activeGamesTab === 'completed'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {completedGames.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        {/* Tab content - contain layout prevents content from affecting container width */}
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
                    </div>
                )}

                {/* New Game Section */}
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Start New Game
                    </h2>

                    <div className="space-y-6">
                        {/* Mode Selection */}
                        <GameModeSelector 
                            selectedMode={selectedMode}
                            onModeChange={setSelectedMode}
                        />

                        {/* Mode-specific options */}
                        {selectedMode === 'knowledge' && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Select Knowledge Categories</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {KNOWLEDGE_CATEGORIES.map((category) => (
                                        <label key={category} className="flex items-center space-x-2 text-gray-900 cursor-pointer">
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

                        {/* Rounds Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Rounds</label>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center space-x-2 text-gray-900 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={rounds.single}
                                        onChange={(e) => setRounds({ ...rounds, single: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm">Single Jeopardy</span>
                                </label>
                                <label className="flex items-center space-x-2 text-gray-900 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={rounds.double}
                                        onChange={(e) => setRounds({ ...rounds, double: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm">Double Jeopardy</span>
                                </label>
                                <label className="flex items-center space-x-2 text-gray-900 cursor-pointer">
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

                        {/* Final Jeopardy Configuration */}
                        {rounds.final && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Final Jeopardy Category</label>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 text-gray-900 cursor-pointer">
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
                                        <label className="flex items-center space-x-2 text-gray-900 cursor-pointer">
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

                        {/* Start Game Button */}
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleStartGame}
                                disabled={
                                    isStartingGame ||
                                    (selectedMode === 'knowledge' && selectedCategories.length === 0) ||
                                    (selectedMode === 'custom' && customCategories.length === 0) ||
                                    (selectedMode === 'date' && !selectedDate) ||
                                    (!rounds.single && !rounds.double && !rounds.final)
                                }
                                className={`btn-primary px-8 py-3 text-lg ${isStartingGame ? 'opacity-50 cursor-wait' : ''}`}
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

                {/* Play Shared Game (Seed Entry) - Subtle section at the bottom */}
                <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <div className="flex-1 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <span className="text-sm text-gray-600 whitespace-nowrap">Have a game code?</span>
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
                                className="w-32 sm:w-36 rounded border border-gray-300 py-1.5 px-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            />
                            <button
                                onClick={handleSeedLookup}
                                disabled={!seedInput.trim() || seedLookupLoading}
                                className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                                    !seedInput.trim() || seedLookupLoading
                                        ? 'text-gray-400 cursor-not-allowed'
                                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                }`}
                            >
                                {seedLookupLoading ? 'Looking up...' : 'Play →'}
                            </button>
                        </div>
                    </div>
                    {seedLookupError && (
                        <p className="mt-2 text-sm text-red-600">{seedLookupError}</p>
                    )}
                </div>
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

