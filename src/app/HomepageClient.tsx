'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AppUser } from '@/lib/clerk-auth'

interface HomepageClientProps {
    user: AppUser | null
    mode: 'game' | 'practice'
}

export default function HomepageClient({ user, mode }: HomepageClientProps) {
    const router = useRouter()
    const [isStarting, setIsStarting] = useState(false)

    const handleGameMode = async () => {
        setIsStarting(true)
        try {
            if (user) {
                // Authenticated user - use regular quick-play
            const response = await fetch('/api/games/quick-play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (!response.ok) {
                throw new Error('Failed to start game')
            }

            const game = await response.json()
            router.push(`/game/${game.id}`)
            } else {
                // Guest user - use guest quick-play
                const response = await fetch('/api/games/guest-quick-play', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })

                if (!response.ok) {
                    throw new Error('Failed to start guest game')
                }

                const guestGame = await response.json()
                router.push(`/play/guest-game/${guestGame.guestGameId}`)
            }
        } catch (error) {
            console.error('Error starting game:', error)
            alert('Failed to start game. Please try again.')
        } finally {
            setIsStarting(false)
        }
    }

    const handlePracticeMode = async () => {
        setIsStarting(true)
        try {
            if (user) {
                // Authenticated user - use regular practice flow
            const response = await fetch('/api/practice/shuffle')
            
            if (!response.ok) {
                throw new Error('Failed to load practice question')
            }

            const question = await response.json()
            
            // Get the category ID from the category name
            // First try to get it from the stats API which returns both knowledgeCategory and categoryId
            try {
                const categoryResponse = await fetch(`/api/stats/category/knowledge?name=${encodeURIComponent(question.originalCategory)}`)
                if (categoryResponse.ok) {
                    const { knowledgeCategory, categoryId } = await categoryResponse.json()
                    // Navigate to practice page with knowledge category, category ID, and question ID
                    router.push(`/practice/category?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}&category=${encodeURIComponent(categoryId)}&question=${question.id}`)
                    return
                }
            } catch (error) {
                console.error('Error fetching category ID:', error)
            }
            
            // Fallback: navigate with just knowledge category and question ID
            // The practice page will handle loading the question
            const knowledgeCategory = question.knowledgeCategory || question.category
            router.push(`/practice/category?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}&question=${question.id}`)
            } else {
                // Guest user - navigate to guest question page
                router.push('/play/guest-question')
            }
        } catch (error) {
            console.error('Error starting practice:', error)
            alert('Failed to start practice. Please try again.')
        } finally {
            setIsStarting(false)
        }
    }

    if (mode === 'game') {
        return (
            <button
                onClick={handleGameMode}
                disabled={isStarting}
                className="group relative h-full rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-8 md:p-12 transition-all duration-300 hover:shadow-3xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-wait disabled:hover:scale-100"
            >
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')]"></div>
                
                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-between gap-6">
                    {/* Random Game Badge */}
                    <div className="flex items-center justify-center">
                        <div className="px-6 py-2 bg-purple-400 rounded-full shadow-lg">
                            <span className="text-purple-900 font-bold text-sm md:text-base tracking-wider uppercase">
                                Random Game
                            </span>
                        </div>
                    </div>

                    {/* Icon and Title */}
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-white/10 backdrop-blur-sm rounded-full border-2 border-white/20">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Random Jeopardy Game</h2>
                        <p className="text-purple-100 text-base md:text-lg">
                            Jump into a randomly generated game with authentic categories and competitive scoring
                        </p>
                    </div>

                    {/* Call to Action */}
                    <div className="text-center">
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-lg border-2 border-white/30 group-hover:bg-white/30 transition-all">
                            {isStarting ? (
                                <>
                                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-4 border-solid border-white border-r-transparent"></span>
                                    <span className="text-white font-semibold text-lg">Starting...</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-white font-semibold text-lg">Start Game</span>
                                    <svg className="w-6 h-6 text-white transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </button>
        )
    }

    // Practice Mode
    return (
        <button
            onClick={handlePracticeMode}
            disabled={isStarting}
            className="group relative h-full rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 p-8 md:p-12 transition-all duration-300 hover:shadow-3xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-wait disabled:hover:scale-100"
        >
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')]"></div>
            
            {/* Content */}
            <div className="relative z-10 h-full flex flex-col">
                {/* Random Question Badge */}
                <div className="flex items-center justify-center mb-6">
                    <div className="px-6 py-2 bg-emerald-400 rounded-full shadow-lg">
                        <span className="text-emerald-900 font-bold text-sm md:text-base tracking-wider uppercase">
                            Random Question
                        </span>
                    </div>
                </div>

                {/* Icon and Title */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-white/10 backdrop-blur-sm rounded-full border-2 border-white/20">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Random Practice Question</h2>
                    <p className="text-emerald-100 text-base md:text-lg">
                        Jump into a random question from any category and test your knowledge
                    </p>
                </div>

                {/* Call to Action */}
                <div className="mt-auto text-center">
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-lg border-2 border-white/30 group-hover:bg-white/30 transition-all">
                        {isStarting ? (
                            <>
                                <span className="inline-block h-5 w-5 animate-spin rounded-full border-4 border-solid border-white border-r-transparent"></span>
                                <span className="text-white font-semibold text-lg">Loading...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-white font-semibold text-lg">Start Practicing</span>
                                <svg className="w-6 h-6 text-white transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </button>
    )
}

