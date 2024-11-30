'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'

export default function AdminPage() {
    const { user } = useAuth()
    const [isAdmin, setIsAdmin] = useState(false)
    const [season, setSeason] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [games, setGames] = useState([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')

    useEffect(() => {
        const checkAdmin = async () => {
            if (!user) return
            try {
                const response = await fetch('/api/admin/games')
                if (response.ok) {
                    setIsAdmin(true)
                    const data = await response.json()
                    setGames(data.games || [])
                }
            } catch (error) {
                console.error('Error checking admin status:', error)
            } finally {
                setLoading(false)
            }
        }

        checkAdmin()
    }, [user])

    const handleSearch = async () => {
        try {
            const params = new URLSearchParams()
            if (season) params.append('season', season)
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)

            const response = await fetch(`/api/admin/games?${params}`)
            if (response.ok) {
                const data = await response.json()
                setGames(data.games || [])
            }
        } catch (error) {
            console.error('Error searching games:', error)
        }
    }

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            const content = await file.text()
            const games = JSON.parse(content)

            const response = await fetch('/api/admin/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'import',
                    data: games
                })
            })

            if (response.ok) {
                setMessage('Games imported successfully')
                handleSearch()
            } else {
                setMessage('Error importing games')
            }
        } catch (error) {
            console.error('Error importing games:', error)
            setMessage('Error importing games')
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete these games?')) return

        try {
            const response = await fetch('/api/admin/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    data: {
                        season: season ? parseInt(season) : undefined,
                        startDate,
                        endDate
                    }
                })
            })

            if (response.ok) {
                setMessage('Games deleted successfully')
                handleSearch()
            } else {
                setMessage('Error deleting games')
            }
        } catch (error) {
            console.error('Error deleting games:', error)
            setMessage('Error deleting games')
        }
    }

    if (loading) {
        return <div className="text-center p-4">Loading...</div>
    }

    if (!isAdmin) {
        return <div className="text-center p-4">Access denied</div>
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold text-black mb-8">Admin Dashboard</h1>

            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-black mb-4">Import/Export Games</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Import Games (JSON)
                        </label>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-black mb-4">Search Games</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Season
                        </label>
                        <input
                            type="number"
                            value={season}
                            onChange={(e) => setSeason(e.target.value)}
                            className="w-full p-2 border rounded"
                            placeholder="Season number"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full p-2 border rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full p-2 border rounded"
                        />
                    </div>
                </div>
                <div className="flex space-x-4">
                    <button
                        onClick={handleSearch}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Search
                    </button>
                    <button
                        onClick={handleDelete}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Delete Matching Games
                    </button>
                </div>
            </div>

            {message && (
                <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
                    {message}
                </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-black mb-4">Games ({games.length})</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Season
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Air Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Question
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Value
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {games.map((game: any) => (
                                <tr key={game.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {game.season}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {game.airDate ? new Date(game.airDate).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {game.category.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {game.question}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ${game.value || 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
} 