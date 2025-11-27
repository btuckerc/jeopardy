'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/auth'

type RoundStats = {
    round: string
    roundName: string
    totalQuestions: number
    totalAnswered: number
    correctAnswers: number
    totalPoints: number
    accuracy: number
}

function RoundCard({ round, stats, href }: { round: 'SINGLE' | 'DOUBLE' | 'FINAL', stats?: RoundStats, href: string }) {
    const bgColor = round === 'SINGLE' ? 'bg-blue-600' : 
                   round === 'DOUBLE' ? 'bg-purple-600' : 
                   'bg-amber-600'
    const hoverColor = round === 'SINGLE' ? 'hover:bg-blue-700' : 
                      round === 'DOUBLE' ? 'hover:bg-purple-700' : 
                      'hover:bg-amber-700'
    
    const roundName = round === 'SINGLE' ? 'Single Jeopardy' : 
                     round === 'DOUBLE' ? 'Double Jeopardy' : 
                     'Final Jeopardy'
    
    const progressPercent = stats && stats.totalQuestions > 0 
        ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) 
        : 0

    return (
        <Link
            href={href}
            className={`group p-8 ${bgColor} ${hoverColor} rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-white`}
        >
            <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                    {round === 'SINGLE' && (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    )}
                    {round === 'DOUBLE' && (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                        </svg>
                    )}
                    {round === 'FINAL' && (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                    )}
                </div>
                <h2 className="text-2xl font-bold">{roundName}</h2>
            </div>
            
            {stats && (
                <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-white/90 text-sm">
                        <span>Answered:</span>
                        <span className="font-medium">{stats.totalAnswered} / {stats.totalQuestions}</span>
                    </div>
                    <div className="flex justify-between text-white/90 text-sm">
                        <span>Correct:</span>
                        <span className="font-medium">{stats.correctAnswers} ({stats.accuracy}%)</span>
                    </div>
                    <div className="flex justify-between text-white/90 text-sm mb-2">
                        <span>Points:</span>
                        <span className="font-medium">${stats.totalPoints.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-white/30 rounded-full h-2">
                        <div
                            className="bg-white h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <p className="text-xs text-white/80 text-center mt-1">{progressPercent}% complete</p>
                </div>
            )}
            
            <div className="mt-6 flex items-center text-white/80 group-hover:text-white transition-colors">
                <span className="font-medium">Start Practicing</span>
                <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </Link>
    )
}

export default function RoundSelection() {
    const { user } = useAuth()
    const [roundStats, setRoundStats] = useState<RoundStats[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchRoundStats = async () => {
            if (!user?.id) {
                setLoading(false)
                return
            }

            try {
                const response = await fetch(`/api/stats?userId=${user.id}`)
                if (response.ok) {
                    const data = await response.json()
                    if (data.roundStats) {
                        setRoundStats(data.roundStats)
                    }
                }
            } catch (error) {
                console.error('Error fetching round stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchRoundStats()
    }, [user?.id])

    const getStatsForRound = (round: 'SINGLE' | 'DOUBLE' | 'FINAL') => {
        return roundStats.find(s => s.round === round)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                    <div className="text-gray-600 font-medium">Loading round selection...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Link
                    href="/practice"
                    className="text-blue-600 hover:text-blue-800 flex items-center font-bold mb-4"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Practice Modes
                </Link>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Practice by Round</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
                <RoundCard 
                    round="SINGLE" 
                    stats={getStatsForRound('SINGLE')}
                    href="/practice/round/single"
                />
                <RoundCard 
                    round="DOUBLE" 
                    stats={getStatsForRound('DOUBLE')}
                    href="/practice/round/double"
                />
                <RoundCard 
                    round="FINAL" 
                    stats={getStatsForRound('FINAL')}
                    href="/practice/round/final"
                />
            </div>
        </div>
    )
}

