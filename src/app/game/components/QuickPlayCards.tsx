'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface QuickPlayCardsProps {
    user: { id: string } | null
    onGameCreated?: (game: { id: string; mode?: string; createdAt?: string; progress?: number }) => void
}

type PresetType = 'classic' | 'quick' | 'practice' | 'challenge'

interface PresetConfig {
    id: PresetType
    title: string
    description: string
    icon: React.ReactNode
    rounds: {
        single: boolean
        double: boolean
        final: boolean
    }
    mode: 'random' | 'knowledge' | 'custom' | 'date'
    categoryFilter?: string
    estimatedTime: string
}

const presets: PresetConfig[] = [
    {
        id: 'classic',
        title: 'Classic Game',
        description: 'Full Jeopardy experience with all three rounds',
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        ),
        rounds: { single: true, double: true, final: true },
        mode: 'random',
        estimatedTime: '20-30 min'
    },
    {
        id: 'quick',
        title: 'Quick Round',
        description: 'Single Jeopardy only - perfect for a quick game',
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        rounds: { single: true, double: false, final: false },
        mode: 'random',
        estimatedTime: '5-10 min'
    },
    {
        id: 'challenge',
        title: 'Challenge Mode',
        description: 'Triple stumpers - the hardest questions',
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        rounds: { single: true, double: true, final: true },
        mode: 'knowledge',
        categoryFilter: 'TRIPLE_STUMPER',
        estimatedTime: '20-30 min'
    },
    {
        id: 'practice',
        title: 'Practice Mode',
        description: 'Study with random category questions',
        icon: (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
        rounds: { single: true, double: true, final: true },
        mode: 'knowledge',
        estimatedTime: '15-20 min'
    }
]

export default function QuickPlayCards({ user, onGameCreated }: QuickPlayCardsProps) {
    const router = useRouter()
    const [startingPreset, setStartingPreset] = useState<PresetType | null>(null)

    const handleStartPreset = async (preset: PresetConfig) => {
        // Practice mode links to the practice page instead of creating a game
        if (preset.id === 'practice') {
            router.push('/practice')
            return
        }

        setStartingPreset(preset.id)
        try {
            const response = await fetch('/api/games/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: preset.mode,
                    rounds: preset.rounds,
                    preset: preset.id, // Pass preset type for labeling
                    ...(preset.mode === 'knowledge' && preset.id !== 'challenge' && { categories: ['GENERAL_KNOWLEDGE'] }),
                    ...(preset.categoryFilter && { categoryFilter: preset.categoryFilter })
                })
            })

            if (!response.ok) {
                if (response.status === 401) {
                    alert('Please sign in to start a game.')
                    router.push('/sign-in?redirect_url=/game')
                    return
                }
                throw new Error('Failed to create game')
            }

            const game = await response.json()
            
            // Notify parent component with game data for optimistic update
            onGameCreated?.({
                id: game.id,
                mode: game.mode || preset.id,
                createdAt: game.createdAt || new Date().toISOString(),
                progress: 0
            })
            
            router.push(`/game/${game.id}`)
        } catch (error) {
            console.error('Error starting game:', error)
            alert('Failed to start game. Please try again.')
        } finally {
            setStartingPreset(null)
        }
    }

    const isPracticeMode = (id: string) => id === 'practice'

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {presets.map((preset) => (
                <button
                    key={preset.id}
                    onClick={() => handleStartPreset(preset)}
                    disabled={startingPreset !== null}
                    className={`
                        relative p-6 rounded-2xl border-2 transition-all duration-300 text-left
                        ${startingPreset === preset.id 
                            ? 'bg-gray-100 border-gray-300 cursor-wait' 
                            : isPracticeMode(preset.id)
                                ? 'bg-white border-dashed border-amber-300 hover:border-amber-500 hover:shadow-lg hover:-translate-y-1'
                                : 'bg-white border-gray-200 hover:border-amber-400 hover:shadow-lg hover:-translate-y-1'
                        }
                    `}
                >
                    {/* Icon */}
                    <div className={`
                        w-14 h-14 rounded-xl flex items-center justify-center mb-4
                        ${preset.id === 'classic' ? 'bg-blue-100 text-blue-600' :
                          preset.id === 'quick' ? 'bg-green-100 text-green-600' :
                          preset.id === 'practice' ? 'bg-amber-100 text-amber-600' :
                          'bg-purple-100 text-purple-600'}
                    `}>
                        {startingPreset === preset.id ? (
                            <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            preset.icon
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                        {preset.title}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 text-sm mb-3">
                        {preset.description}
                    </p>

                    {/* Practice Mode CTA or Regular Content */}
                    {isPracticeMode(preset.id) ? (
                        <div className="mt-2 flex items-center gap-2 text-amber-600 font-semibold text-sm group">
                            <span>Study</span>
                            <svg 
                                className="w-4 h-4 transition-transform group-hover:translate-x-1" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </div>
                    ) : (
                        <>
                            {/* Estimated time */}
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {preset.estimatedTime}
                            </div>

                            {/* Round indicators */}
                            <div className="mt-4 flex gap-1">
                                {preset.rounds.single && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                                        Single
                                    </span>
                                )}
                                {preset.rounds.double && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded font-medium">
                                        Double
                                    </span>
                                )}
                                {preset.rounds.final && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                                        Final
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </button>
            ))}
        </div>
    )
}
