'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'

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

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth()
    const [isAdmin, setIsAdmin] = useState(false)
    const [games, setGames] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
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
    const [activeTab, setActiveTab] = useState<'manage' | 'fetch' | 'player-games'>('manage')
    
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

    useEffect(() => {
        const checkAdmin = async () => {
            if (authLoading) return
            
            if (!user) {
                setLoading(false)
                setError('You must be signed in to access this page.')
                return
            }

            const userIsAdmin = user.role === 'ADMIN'
            setIsAdmin(userIsAdmin)

            if (!userIsAdmin) {
                setLoading(false)
                setError('Access denied. Admin privileges required.')
                return
            }

            try {
                const response = await fetch('/api/admin/games')
                if (response.ok) {
                    const data = await response.json()
                    setGames(data.games || [])
                } else if (response.status === 403) {
                    setError('Access denied. Admin privileges required.')
                } else {
                    setError('Failed to load games. Please try again.')
                }
            } catch (error) {
                console.error('Error fetching games:', error)
                setError('Failed to load games. Please try again.')
            } finally {
                setLoading(false)
            }
        }

        checkAdmin()
    }, [user, authLoading])

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
        if (isAdmin) {
            fetchCalendarStats()
        }
    }, [isAdmin, fetchCalendarStats])

    // Fetch player games
    const fetchPlayerGames = useCallback(async () => {
        setLoadingPlayerGames(true)
        try {
            const params = new URLSearchParams()
            if (playerGamesFilter !== 'all') {
                params.append('status', playerGamesFilter)
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
    }, [playerGamesFilter])

    // Load player games when tab is active
    useEffect(() => {
        if (isAdmin && activeTab === 'player-games') {
            fetchPlayerGames()
        }
    }, [isAdmin, activeTab, fetchPlayerGames])

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

    if (loading || authLoading) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center p-8">
                    <div className="text-lg">Loading...</div>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold text-black mb-4">Access Denied</h1>
                    <p className="text-gray-600 mb-4">You must be signed in to access this page.</p>
                    <a href="/auth/signin" className="text-blue-600 hover:underline">
                        Sign in
                    </a>
                </div>
            </div>
        )
    }

    if (!isAdmin || error) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold text-black mb-4">Access Denied</h1>
                    <p className="text-gray-600">
                        {error || 'Admin privileges required to access this page.'}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold text-black mb-6">Admin Dashboard</h1>

            {/* Tab Navigation */}
            <div className="mb-6">
                <div className="flex gap-3">
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={`flex-1 py-3 px-6 rounded-lg font-semibold text-base transition-all border-2 ${
                            activeTab === 'manage'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                    >
                        Manage Games
                    </button>
                    <button
                        onClick={() => setActiveTab('fetch')}
                        className={`flex-1 py-3 px-6 rounded-lg font-semibold text-base transition-all border-2 ${
                            activeTab === 'fetch'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                    >
                        Fetch from j-archive
                    </button>
                    <button
                        onClick={() => setActiveTab('player-games')}
                        className={`flex-1 py-3 px-6 rounded-lg font-semibold text-base transition-all border-2 ${
                            activeTab === 'player-games'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                    >
                        Player Games
                    </button>
                </div>
            </div>

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
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">{fetchedGame.title}</h3>
                                <p className="text-sm text-gray-800">
                                    Air Date: {fetchedGame.airDate || 'Unknown'} | 
                                    Game ID: {fetchedGame.gameId} | 
                                    Questions: {fetchedGame.questionCount}
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
                        <div className="mb-4 text-sm text-gray-700">
                            <span className="font-medium">Categories:</span> {fetchedGame.categories.length} | 
                            <span className="ml-2 font-medium">Single:</span> {fetchedGame.categories.filter((c: Category) => c.round === 'single').length} | 
                            <span className="ml-2 font-medium">Double:</span> {fetchedGame.categories.filter((c: Category) => c.round === 'double').length} |
                            <span className="ml-2 font-medium">Final:</span> {fetchedGame.categories.filter((c: Category) => c.round === 'final').length}
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
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-gray-900">
                                Fetched Games ({batchFetchedGames.length})
                            </h3>
                            <div className="flex items-center gap-4">
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
                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {batchPushing ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Pushing...
                                        </>
                                    ) : (
                                        `Push Selected (${selectedGameIds.size})`
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
                                                    <p className="text-sm text-gray-700">
                                                        Air Date: {game.airDate ? formatDateString(game.airDate) : 'Unknown'} | 
                                                        Game ID: {game.gameId} | 
                                                        Questions: {game.questionCount}
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
                    <div className="flex items-center gap-4 mb-6">
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
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900">
                                                    {game.user?.displayName || game.user?.email || 'Unknown User'}
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                    game.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                                    game.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {game.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Game ID: <code className="bg-gray-200 px-1 rounded text-xs">{game.id}</code>
                                                {game.seed && (
                                                    <> | Seed: <code className="bg-gray-200 px-1 rounded text-xs">{game.seed}</code></>
                                                )}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Mode: {game.config?.mode || 'unknown'} | 
                                                Round: {game.currentRound} | 
                                                Score: <span className={game.currentScore >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                    ${game.currentScore.toLocaleString()}
                                                </span>
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Questions answered: {game.answeredQuestions} ({game.correctQuestions} correct)
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Created: {new Date(game.createdAt).toLocaleString()} | 
                                                Updated: {new Date(game.updatedAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditGame(game)}
                                                className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGame(game.id)}
                                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
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

            {/* Edit Game Modal */}
            {editingGame && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
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
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setEditingGame(null)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveGameEdit}
                                disabled={savingGameEdit}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
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
                            <div className="mt-6 p-4 bg-gray-50 rounded border">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-lg text-gray-900">
                                        {formatDateString(selectedCalendarDate)}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setSelectedCalendarDate(null)
                                            setDateGameData([])
                                        }}
                                        className="text-gray-500 hover:text-gray-700"
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
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-lg text-gray-900">
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
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={openRefetchConfirmation}
                                    disabled={refetching || selectedExistingDates.size === 0}
                                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {refetching ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Re-fetching...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Re-fetch Selected ({selectedExistingDates.size})
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={openDeleteConfirmation}
                                    disabled={deleting || selectedExistingDates.size === 0}
                                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Selected ({selectedExistingDates.size})
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-gray-900">
                                {calendarFetchDate ? `Fetch Game: ${formatDateString(calendarFetchDate)}` : 'Fetch Game'}
                            </h3>
                            <button
                                onClick={closeCalendarFetchModal}
                                className="text-gray-500 hover:text-gray-700"
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
                                    <p className="text-sm text-gray-600 mb-2">
                                        <span className="mr-3">Single: {calendarFetchedGame.categories.filter((c: Category) => c.round === 'single').length} categories</span>
                                        <span className="mr-3">Double: {calendarFetchedGame.categories.filter((c: Category) => c.round === 'double').length} categories</span>
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
                                
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={closeCalendarFetchModal}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCalendarPushGame}
                                        disabled={calendarPushing}
                                        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                        <h3 className="text-xl font-bold text-yellow-600 mb-4">Confirm Re-fetch</h3>
                        <p className="text-gray-700 mb-4">
                            You are about to re-fetch <strong>{selectedExistingDates.size} date(s)</strong> from j-archive.
                        </p>
                        <p className="text-gray-700 mb-4">
                            This will delete the existing data for these dates and replace it with fresh data from j-archive.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowRefetchConfirm(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRefetchSelected}
                                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                            >
                                Re-fetch Games
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
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
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    setDeleteConfirmText('')
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={deleteConfirmText !== 'DELETE' || deleting}
                                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

            {/* Back to Top Button */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 bg-amber-400 hover:bg-amber-500 text-blue-900 p-4 rounded-full shadow-2xl ring-4 ring-white/50 transition-all duration-300 z-50 flex items-center justify-center hover:scale-110"
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
                className="w-full p-3 bg-gray-100 hover:bg-gray-200 flex justify-between items-center text-left"
            >
                <span className="font-semibold text-gray-900">
                    {category.name} ({category.round === 'single' ? 'Single Jeopardy' : category.round === 'double' ? 'Double Jeopardy' : 'Final Jeopardy'}) - {category.questions.length} {category.questions.length === 1 ? 'question' : 'questions'}
                </span>
                <svg
                    className={`w-5 h-5 transform transition-transform text-gray-900 ${isOpen ? 'rotate-180' : ''}`}
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
                    className="flex-1 p-4 pl-0 flex justify-between items-center text-left hover:bg-gray-50"
                >
                    <div>
                        <span className="font-bold text-lg text-gray-900">
                            {group.airDate === 'unknown' ? 'Unknown Date' : formatDateString(group.airDate)}
                        </span>
                        <span className="ml-4 text-gray-700">
                            {group.questionCount} questions | 
                            Single: {group.singleJeopardy.length} | 
                            Double: {group.doubleJeopardy.length} |
                            Final: {group.finalJeopardy.length}
                        </span>
                    </div>
                    <svg
                        className={`w-5 h-5 transform transition-transform text-gray-700 ${isOpen ? 'rotate-180' : ''}`}
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
                className="w-full p-4 bg-gray-100 hover:bg-gray-200 flex justify-between items-center text-left"
            >
                <div>
                    <span className="font-bold text-lg text-gray-900">
                        {group.airDate === 'unknown' ? 'Unknown Date' : formatDateString(group.airDate)}
                    </span>
                    <span className="ml-4 text-gray-800">
                        {group.questionCount} questions | 
                        Single: {group.singleJeopardy.length} categories | 
                        Double: {group.doubleJeopardy.length} categories
                    </span>
                </div>
                <svg
                    className={`w-5 h-5 transform transition-transform text-gray-900 ${isOpen ? 'rotate-180' : ''}`}
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
            <div className="mb-4 flex items-center gap-4">
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => onMonthChange(e.target.value)}
                    className="p-2 border rounded text-gray-900"
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
                            className={`p-2 text-center text-sm border rounded ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'} ${bgColor} ${borderColor} ${textColor} ${
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
            <div className="mt-4 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-200 border-2 border-green-500 rounded"></div>
                    <span className="text-gray-900">Has data</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
                    <span className="text-gray-900">Missing</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
                    <span className="text-gray-900">Future</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
                    <span className="text-gray-900">Today</span>
                </div>
            </div>
        </div>
    )
}
