'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/auth'
import { Combobox } from '@headlessui/react'
import { CheckIcon } from '@heroicons/react/20/solid'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import Link from 'next/link'

interface Category {
    id: string
    name: string
    airDate?: Date
    isDoubleJeopardy: boolean
    _count?: {
        questions: number
    }
}

interface ResumableGame {
    id: string
    seed: string | null
    label: string
    status: string
    currentRound: string
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

interface ComboboxRenderPropArg {
    active: boolean
    disabled: boolean
    selected: boolean
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

export default function GameHubPage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    
    // Resumable games state
    const [resumableGames, setResumableGames] = useState<ResumableGame[]>([])
    const [loadingGames, setLoadingGames] = useState(true)
    
    // New game configuration state
    const [selectedMode, setSelectedMode] = useState<'random' | 'knowledge' | 'custom' | 'date'>('random')
    const [selectedCategories, setSelectedCategories] = useState<KnowledgeCategory[]>([])
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null)
    const [availableCategories, setAvailableCategories] = useState<Category[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [customCategories, setCustomCategories] = useState<Category[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [availableDates, setAvailableDates] = useState<string[]>([])
    const [isLoadingDates, setIsLoadingDates] = useState(false)
    const [rounds, setRounds] = useState({ single: true, double: true, final: false })
    const [finalCategoryMode, setFinalCategoryMode] = useState<'shuffle' | 'byDate' | 'specificCategory'>('byDate')
    const [finalCategoryId, setFinalCategoryId] = useState<string | null>(null)
    const [isStartingGame, setIsStartingGame] = useState(false)
    
    // Warning modal state
    const [showWarningModal, setShowWarningModal] = useState(false)
    const [pendingGameConfig, setPendingGameConfig] = useState<any>(null)
    const [availableCategoriesForFill, setAvailableCategoriesForFill] = useState<Category[]>([])
    const [isLoadingFillCategories, setIsLoadingFillCategories] = useState(false)
    const [fillCategorySearchQuery, setFillCategorySearchQuery] = useState('')

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

    // Spoiler settings state
    const [spoilerSettings, setSpoilerSettings] = useState<{
        enabled: boolean
        cutoffDate: Date | null
    } | null>(null)
    const [showSpoilerWarningModal, setShowSpoilerWarningModal] = useState(false)
    const [spoilerWarningConfig, setSpoilerWarningConfig] = useState<any>(null)
    const [spoilerWarningDate, setSpoilerWarningDate] = useState<string | null>(null)
    const [updatingSpoilerDate, setUpdatingSpoilerDate] = useState(false)

    // Fetch resumable games and spoiler settings
    // Note: We use user?.id as the dependency instead of user because useAuth()
    // creates a new user object on every render, which would cause infinite loops
    useEffect(() => {
        if (!user?.id) {
            setLoadingGames(false)
            return
        }

        const fetchResumableGames = async () => {
            try {
                const response = await fetch('/api/games/resumable')
                if (response.ok) {
                    const data = await response.json()
                    setResumableGames(data.games || [])
                }
            } catch (error) {
                console.error('Error fetching resumable games:', error)
            } finally {
                setLoadingGames(false)
            }
        }

        const fetchSpoilerSettings = async () => {
            try {
                const response = await fetch('/api/user/spoiler-settings')
                if (response.ok) {
                    const data = await response.json()
                    setSpoilerSettings({
                        enabled: data.spoilerBlockEnabled ?? false,
                        cutoffDate: data.spoilerBlockDate ? new Date(data.spoilerBlockDate) : null
                    })
                }
            } catch (error) {
                console.error('Error fetching spoiler settings:', error)
            }
        }

        fetchResumableGames()
        fetchSpoilerSettings()
    }, [user?.id])

    // Date picker utilities
    const availableDateObjects = useMemo(() =>
        availableDates.map(date => new Date(date)),
        [availableDates]
    )

    const { availableYears, minYear, maxYear } = useMemo(() => {
        if (availableDates.length === 0) {
            return { availableYears: [], minYear: new Date().getFullYear(), maxYear: new Date().getFullYear() }
        }
        const years = availableDates.map(date => new Date(date).getFullYear())
        const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a)
        return {
            availableYears: uniqueYears,
            minYear: Math.min(...uniqueYears),
            maxYear: Math.max(...uniqueYears)
        }
    }, [availableDates])

    const handleDateChange = (date: Date | null) => {
        setSelectedDateObj(date)
        setSelectedDate(date ? date.toISOString().split('T')[0] : '')
    }

    const isDateAvailable = (date: Date) => {
        return availableDateObjects.some(availableDate =>
            availableDate.toISOString().split('T')[0] === date.toISOString().split('T')[0]
        )
    }

    const renderYearContent = (year: number) => {
        const hasEpisodes = availableYears.includes(year)
        return (
            <span className={!hasEpisodes ? 'text-gray-300' : undefined}>
                {year}
            </span>
        )
    }

    // Fetch available dates
    useEffect(() => {
        const fetchAvailableDates = async () => {
            setIsLoadingDates(true)
            try {
                const response = await fetch('/api/game/available-dates')
                const data = await response.json()
                if (data.dates) {
                    setAvailableDates(data.dates)
                }
            } catch (error) {
                console.error('Error fetching available dates:', error)
            }
            setIsLoadingDates(false)
        }

        fetchAvailableDates()
    }, [])

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

    // Debounced search for categories
    useEffect(() => {
        if (selectedMode !== 'custom' || !searchQuery || searchQuery.length < 2) {
            setAvailableCategories([])
            return
        }

        const timer = setTimeout(async () => {
            setIsSearching(true)
            try {
                const response = await fetch(`/api/categories/search?q=${encodeURIComponent(searchQuery)}`)
                if (!response.ok) throw new Error('Failed to search categories')
                const data = await response.json()
                setAvailableCategories(data.filter((cat: Category) => !cat.isDoubleJeopardy))
            } catch (error) {
                console.error('Error searching categories:', error)
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery, selectedMode])

    const filteredCategories = useMemo(() =>
        searchQuery === ''
            ? availableCategories
            : availableCategories.filter((category) =>
                category.name.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        [searchQuery, availableCategories]
    )

    const checkIfWarningNeeded = async (config: any, mode: string): Promise<boolean> => {
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
    const checkSpoilerConflict = (config: any): { hasConflict: boolean; conflictDate: string | null } => {
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

        let gameConfig: any

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

    const createAndStartGame = async (gameConfig: any) => {
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
                setResumableGames(games => games.filter(g => g.id !== gameId))
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

    const handleCopySeed = (seed: string) => {
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

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays === 1) return 'yesterday'
        return `${diffDays}d ago`
    }

    // Show sign-in prompt if not authenticated
    if (!authLoading && !user) {
        return (
            <div className="min-h-screen bg-gray-100 py-12 px-4">
                <div className="max-w-md mx-auto">
                    <div className="card text-center p-8">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Play Jeopardy!</h1>
                        <p className="text-gray-600 mb-6">Sign in to start a new game or resume where you left off.</p>
                        <Link href="/sign-in?redirect_url=/game" className="btn-primary inline-flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Sign In to Play
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Play Game</h1>
                    <p className="text-gray-600">Start a new game or continue where you left off.</p>
                </div>

                {/* Resumable Games Section */}
                {user && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Your Games
                        </h2>

                        {loadingGames ? (
                            <div className="card p-6 text-center">
                                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-2"></div>
                                <p className="text-gray-500">Loading your games...</p>
                            </div>
                        ) : resumableGames.length === 0 ? (
                            <div className="card p-6 text-center bg-gray-50 border-dashed">
                                <p className="text-gray-500">No games in progress. Start a new game below!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {resumableGames.map(game => {
                                    const MAX_VISIBLE_CATEGORIES = 3
                                    const visibleCategories = game.categories.slice(0, MAX_VISIBLE_CATEGORIES)
                                    const hiddenCount = game.categories.length - MAX_VISIBLE_CATEGORIES

                                    return (
                                        <div
                                            key={game.id}
                                            className="card p-4 hover:shadow-md transition-shadow border border-gray-100"
                                        >
                                            {/* Top row: title + metadata on left, actions on right */}
                                            <div className="flex items-start justify-between gap-4">
                                                {/* Left: Game info */}
                                                <div className="flex-1 min-w-0">
                                                    {/* Title row */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-semibold text-gray-900">
                                                            {game.label}
                                                        </h3>
                                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                                            {game.currentRound === 'SINGLE' ? 'Single' : 
                                                             game.currentRound === 'DOUBLE' ? 'Double' : 
                                                             'Final'}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {formatTimeAgo(game.updatedAt)}
                                                        </span>
                                                        {game.seed && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    navigator.clipboard.writeText(game.seed!)
                                                                    const btn = e.currentTarget
                                                                    const originalText = btn.textContent
                                                                    btn.textContent = 'Copied!'
                                                                    btn.classList.add('text-green-600', 'bg-green-50')
                                                                    btn.classList.remove('text-gray-400', 'bg-gray-50')
                                                                    setTimeout(() => {
                                                                        btn.textContent = originalText
                                                                        btn.classList.remove('text-green-600', 'bg-green-50')
                                                                        btn.classList.add('text-gray-400', 'bg-gray-50')
                                                                    }, 1500)
                                                                }}
                                                                className="text-xs text-gray-400 hover:text-gray-600 font-mono bg-gray-50 px-1.5 py-0.5 rounded transition-colors"
                                                                title="Click to copy seed and share with friends"
                                                            >
                                                                {game.seed}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Categories row */}
                                                    {game.categories.length > 0 && (
                                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                            {visibleCategories.map(cat => (
                                                                <span
                                                                    key={cat.id}
                                                                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded whitespace-nowrap"
                                                                >
                                                                    {cat.name}
                                                                </span>
                                                            ))}
                                                            {hiddenCount > 0 && (
                                                                <span className="text-xs text-gray-400">
                                                                    +{hiddenCount} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEndGame(game.id)
                                                        }}
                                                        className="text-xs text-gray-400 hover:text-red-500 focus:text-red-500 focus:outline-none transition-colors"
                                                        title="End game"
                                                    >
                                                        End
                                                    </button>
                                                    <Link
                                                        href={`/game/${game.id}`}
                                                        className="btn-primary px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                                    >
                                                        Resume
                                                    </Link>
                                                </div>
                                            </div>

                                            {/* Bottom row: Progress bar + stats */}
                                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                                                {/* Progress bar */}
                                                <div className="flex-1">
                                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-500 rounded-full transition-all"
                                                            style={{ width: `${game.progress.percentComplete}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                {/* Stats inline */}
                                                <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                                                    <span>{game.progress.percentComplete}%</span>
                                                    <span>{game.progress.correctQuestions}/{game.progress.answeredQuestions} correct</span>
                                                    <span className={`font-medium ${game.currentScore >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                                        {game.currentScore < 0 ? '-' : ''}${Math.abs(game.currentScore).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Game Mode</label>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <button
                                    onClick={() => setSelectedMode('date')}
                                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all ${selectedMode === 'date'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    By Air Date
                                </button>
                                <button
                                    onClick={() => setSelectedMode('random')}
                                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all ${selectedMode === 'random'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    Random
                                </button>
                                <button
                                    onClick={() => setSelectedMode('knowledge')}
                                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all ${selectedMode === 'knowledge'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    Knowledge Areas
                                </button>
                                <button
                                    onClick={() => setSelectedMode('custom')}
                                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all ${selectedMode === 'custom'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    Custom
                                </button>
                            </div>
                        </div>

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
                            <div className="bg-gray-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Select Categories (up to 5)</label>
                                <Combobox
                                    value={null}
                                    onChange={(category: Category | null) => {
                                        if (!category) return
                                        if (customCategories.some(c => c.id === category.id)) {
                                            setCustomCategories(customCategories.filter(c => c.id !== category.id))
                                        } else if (customCategories.length < 5) {
                                            setCustomCategories([...customCategories, category])
                                        }
                                        setSearchQuery('')
                                    }}
                                >
                                    <div className="relative">
                                        <Combobox.Input
                                            className="w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                                            displayValue={() => ''}
                                            placeholder="Type to search categories..."
                                        />
                                        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 shadow-lg border border-gray-200">
                                            {isSearching ? (
                                                <div className="px-4 py-2 text-sm text-gray-500">Searching...</div>
                                            ) : searchQuery.length < 2 ? (
                                                <div className="px-4 py-2 text-sm text-gray-500">Type at least 2 characters...</div>
                                            ) : filteredCategories.length === 0 ? (
                                                <div className="px-4 py-2 text-sm text-gray-500">No categories found</div>
                                            ) : (
                                                filteredCategories.map((category) => {
                                                    const isSelected = customCategories.some(c => c.id === category.id)
                                                    const isDisabled = customCategories.length >= 5 && !isSelected
                                                    return (
                                                        <Combobox.Option
                                                            key={category.id}
                                                            value={category}
                                                            disabled={isDisabled}
                                                            className={({ active, disabled }: ComboboxRenderPropArg) =>
                                                                `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
                                                            }
                                                        >
                                                            {({ active }: { active: boolean }) => (
                                                                <>
                                                                    <span className={`block truncate ${isSelected ? 'font-medium' : 'font-normal'}`}>
                                                                        {category.name}
                                                                        {category._count && ` (${category._count.questions} questions)`}
                                                                    </span>
                                                                    {isSelected && (
                                                                        <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-blue-600'}`}>
                                                                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </Combobox.Option>
                                                    )
                                                })
                                            )}
                                        </Combobox.Options>
                                    </div>
                                </Combobox>
                                {customCategories.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {customCategories.map((category) => (
                                            <span
                                                key={category.id}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                                            >
                                                {category.name}
                                                <button
                                                    type="button"
                                                    onClick={() => setCustomCategories(customCategories.filter(c => c.id !== category.id))}
                                                    className="ml-2 inline-flex items-center p-0.5 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedMode === 'date' && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Select Air Date</label>
                                {isLoadingDates ? (
                                    <div className="text-gray-500">Loading available dates...</div>
                                ) : availableDates.length === 0 ? (
                                    <div className="text-gray-500">No dates available</div>
                                ) : (
                                    <DatePicker
                                        selected={selectedDateObj}
                                        onChange={handleDateChange}
                                        filterDate={isDateAvailable}
                                        dateFormat="MMMM d, yyyy"
                                        placeholderText="Select an air date"
                                        className="w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        calendarClassName="bg-white shadow-lg rounded-lg border border-gray-200"
                                        showMonthDropdown
                                        showYearDropdown
                                        dropdownMode="select"
                                        minDate={new Date(minYear, 0, 1)}
                                        maxDate={new Date(maxYear, 11, 31)}
                                        renderYearContent={renderYearContent}
                                        yearDropdownItemNumber={maxYear - minYear + 1}
                                        scrollableYearDropdown
                                        isClearable
                                    />
                                )}
                            </div>
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
            {showSeedModal && seedLookupResult && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Play Shared Game</h2>
                            <button
                                onClick={() => {
                                    setShowSeedModal(false)
                                    setSeedLookupResult(null)
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Game Info */}
                            <div className="bg-blue-50 rounded-lg p-4">
                                <h3 className="font-bold text-lg text-gray-900 mb-2">{seedLookupResult.label}</h3>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p>
                                        <span className="font-medium">Mode:</span>{' '}
                                        {seedLookupResult.mode === 'random' ? 'Random' :
                                         seedLookupResult.mode === 'knowledge' ? 'Knowledge Areas' :
                                         seedLookupResult.mode === 'custom' ? 'Custom Categories' :
                                         seedLookupResult.mode === 'date' ? 'By Air Date' : seedLookupResult.mode}
                                    </p>
                                    <p>
                                        <span className="font-medium">Rounds:</span>{' '}
                                        {seedLookupResult.rounds.join(', ')}
                                    </p>
                                    <p>
                                        <span className="font-medium">Shared by:</span>{' '}
                                        {seedLookupResult.createdBy}
                                    </p>
                                </div>
                            </div>

                            {/* Seed Display */}
                            <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Seed:</span>
                                <code className="flex-1 font-mono text-sm text-gray-800">{seedLookupResult.seed}</code>
                            </div>

                            {seedLookupError && (
                                <p className="text-sm text-red-600">{seedLookupError}</p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setShowSeedModal(false)
                                        setSeedLookupResult(null)
                                    }}
                                    className="flex-1 btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleStartFromSeed}
                                    disabled={startingFromSeed}
                                    className={`flex-1 btn-primary ${startingFromSeed ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                    {startingFromSeed ? 'Starting...' : 'Start Game'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Warning Modal */}
            {showWarningModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        <h2 className="text-2xl font-bold mb-4 text-gray-900">Insufficient Categories</h2>
                        <p className="text-gray-700 mb-6">
                            {selectedMode === 'custom' ? (
                                <>You have selected <strong>{customCategories.length}</strong> categor{customCategories.length === 1 ? 'y' : 'ies'}</>
                            ) : (
                                <>You have selected <strong>{selectedCategories.length}</strong> knowledge area{selectedCategories.length !== 1 ? 's' : ''}</>
                            )}
                            {' '}but a full game typically requires 5 categories per round. This may result in a partial game board.
                        </p>
                        
                        {selectedMode === 'custom' && availableCategoriesForFill.length > 0 && customCategories.length < 5 && (
                            <div className="border rounded-lg p-4 mb-4">
                                <h3 className="font-medium mb-2 text-gray-900">Add Random Categories</h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Automatically add {5 - customCategories.length} random category{5 - customCategories.length !== 1 ? 'ies' : ''} to fill the board.
                                </p>
                                <button
                                    onClick={handleAddRandomCategories}
                                    className="btn-primary btn-sm"
                                >
                                    Add Random Categories
                                </button>
                            </div>
                        )}

                        {selectedMode === 'custom' && customCategories.length < 5 && (
                            <div className="border rounded-lg p-4 mb-4">
                                <h3 className="font-medium mb-2 text-gray-900">Select Additional Categories</h3>
                                <input
                                    type="text"
                                    value={fillCategorySearchQuery}
                                    onChange={(e) => setFillCategorySearchQuery(e.target.value)}
                                    className="w-full p-2 border rounded-lg mb-3 text-gray-900"
                                    placeholder="Search categories..."
                                />
                                {isLoadingFillCategories ? (
                                    <div className="text-gray-500">Loading...</div>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto space-y-2">
                                        {availableCategoriesForFill
                                            .filter(cat => 
                                                fillCategorySearchQuery === '' ||
                                                cat.name.toLowerCase().includes(fillCategorySearchQuery.toLowerCase())
                                            )
                                            .slice(0, 20)
                                            .map((category) => (
                                                <button
                                                    key={category.id}
                                                    onClick={() => handleAddSelectedCategory(category)}
                                                    disabled={customCategories.length >= 5 || customCategories.some(c => c.id === category.id)}
                                                    className={`w-full text-left p-2 rounded text-sm ${
                                                        customCategories.some(c => c.id === category.id)
                                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                            : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                                                    }`}
                                                >
                                                    {category.name} ({category._count?.questions || 0} questions)
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowWarningModal(false)
                                    setPendingGameConfig(null)
                                }}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmStartGame}
                                className="btn-primary"
                            >
                                Start Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Spoiler Warning Modal */}
            {showSpoilerWarningModal && spoilerWarningConfig && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Spoiler Warning</h2>
                                <p className="text-sm text-gray-500 mt-1">This game may include questions you haven&apos;t seen yet</p>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                            <p className="text-gray-800">
                                Based on your spoiler settings, this game might include questions which spoil up to{' '}
                                <strong>{spoilerWarningDate}</strong>.
                            </p>
                            {spoilerSettings?.cutoffDate && (
                                <p className="text-gray-600 text-sm mt-2">
                                    Your current spoiler protection blocks episodes from{' '}
                                    <strong>
                                        {spoilerSettings.cutoffDate.toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </strong>{' '}
                                    and later.
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <p className="text-sm font-medium text-gray-700">What would you like to do?</p>

                            {/* Option 1: Update spoiler date */}
                            {spoilerWarningConfig.date && (
                                <button
                                    onClick={() => {
                                        // Set the new cutoff to the day after the episode date
                                        const episodeDate = new Date(spoilerWarningConfig.date)
                                        const newCutoff = new Date(episodeDate)
                                        newCutoff.setDate(newCutoff.getDate() + 1)
                                        handleUpdateSpoilerDate(newCutoff)
                                    }}
                                    disabled={updatingSpoilerDate}
                                    className="w-full p-3 text-left rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Update my spoiler date</p>
                                            <p className="text-sm text-gray-500">
                                                Change your cutoff to include this episode ({spoilerWarningDate})
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            )}

                            {/* Option 2: Proceed anyway */}
                            <button
                                onClick={handleProceedWithSpoiler}
                                disabled={updatingSpoilerDate}
                                className="w-full p-3 text-left rounded-lg border border-gray-200 hover:border-amber-500 hover:bg-amber-50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center group-hover:bg-amber-200">
                                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Proceed anyway for this game</p>
                                        <p className="text-sm text-gray-500">
                                            Start the game without changing your spoiler settings
                                        </p>
                                    </div>
                                </div>
                            </button>

                            {/* Option 3: Choose a custom date */}
                            <div className="p-3 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Choose a different cutoff date</p>
                                        <p className="text-sm text-gray-500">
                                            Set a custom date for your spoiler protection
                                        </p>
                                    </div>
                                </div>
                                <div className="pl-11">
                                    <input
                                        type="date"
                                        value={spoilerSettings?.cutoffDate ? spoilerSettings.cutoffDate.toISOString().split('T')[0] : ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                const newDate = new Date(e.target.value)
                                                // Add one day to make it the cutoff (show episodes before this date)
                                                newDate.setDate(newDate.getDate() + 1)
                                                handleUpdateSpoilerDate(newDate)
                                            }
                                        }}
                                        disabled={updatingSpoilerDate}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 text-gray-900 text-sm transition-all duration-200"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Episodes aired before this date will be available
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setShowSpoilerWarningModal(false)
                                    setSpoilerWarningConfig(null)
                                    setSpoilerWarningDate(null)
                                }}
                                disabled={updatingSpoilerDate}
                                className="w-full btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
