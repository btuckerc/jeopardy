'use client'

import Link from 'next/link'
import { getNextChallengeTimeISO } from '@/lib/daily-challenge-utils'
import NextChallengeCallout from './NextChallengeCallout'

interface DailyChallenge {
    id: string
    date: string
    question: {
        id: string
        question: string
        answer: string
        category: string
        airDate: string | null
    }
    userAnswer: {
        correct: boolean
        completedAt: string
    } | null
}

interface DailyChallengeStats {
    participationStreak: {
        current: number
        longest: number
    }
    correctnessStreak: {
        current: number
        longest: number
    }
    totalCompleted: number
    totalCorrect: number
    accuracy: number
}

interface DailyChallengeCardClientProps {
    challenge: DailyChallenge | null
    stats: DailyChallengeStats | null
}

export default function DailyChallengeCardClient({ challenge, stats }: DailyChallengeCardClientProps) {
    const nextChallengeTime = getNextChallengeTimeISO()

    // If no challenge data, show a fallback CTA
    if (!challenge) {
        return (
            <div className="space-y-4">
                <Link href="/daily-challenge" className="block group">
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-8 md:p-12 transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02]">
                        <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')]"></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-center mb-6">
                                <div className="px-6 py-2 bg-amber-400 rounded-full shadow-lg">
                                    <span className="text-blue-900 font-bold text-sm md:text-base tracking-wider uppercase">
                                        Daily Challenge
                                    </span>
                                </div>
                            </div>
                            <div className="text-center mb-8">
                                <div className="inline-block px-6 py-3 bg-white/10 backdrop-blur-sm rounded-lg border-2 border-white/20 mb-4">
                                    <p className="text-white text-xl md:text-2xl font-semibold tracking-wide">
                                        Today&apos;s Final Jeopardy
                                    </p>
                                </div>
                                <p className="text-blue-100 text-base md:text-lg mt-4">
                                    Test your knowledge with a classic Final Jeopardy question
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-lg border-2 border-white/30 group-hover:bg-white/30 transition-all">
                                    <span className="text-white font-semibold text-lg">Take the Challenge</span>
                                    <svg className="w-6 h-6 text-white transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>
        )
    }

    const hasAnswered = challenge.userAnswer !== null

    return (
        <div className="space-y-4">
            <Link href="/daily-challenge" className="block group">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-8 md:p-12 transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02]">
                    <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')]"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-center mb-6">
                            <div className="px-6 py-2 bg-amber-400 rounded-full shadow-lg">
                                <span className="text-blue-900 font-bold text-sm md:text-base tracking-wider uppercase">
                                    Daily Challenge
                                </span>
                            </div>
                        </div>

                        {/* Final Jeopardy Style Category */}
                        <div className="text-center mb-6">
                            <div className="inline-block px-6 py-3 bg-white/10 backdrop-blur-sm rounded-lg border-2 border-white/20 mb-4">
                                <p className="text-white text-xl md:text-2xl font-semibold tracking-wide">
                                    {challenge.question.category}
                                </p>
                            </div>
                            {hasAnswered && challenge.userAnswer && (
                                <div className="mt-4">
                                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                                        challenge.userAnswer.correct 
                                            ? 'bg-green-500 text-white' 
                                            : 'bg-red-500 text-white'
                                    }`}>
                                        {challenge.userAnswer.correct ? (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Correct
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Incorrect
                                            </>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Stats Row - Show streak and performance */}
                        {stats && (
                            <div className="mb-6 flex items-center justify-center gap-4 text-sm">
                                {stats.participationStreak.current > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full">
                                        <span className="text-lg">🔥</span>
                                        <span className="text-white font-semibold">{stats.participationStreak.current} day streak</span>
                                    </div>
                                )}
                                {stats.totalCompleted > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full">
                                        <span className="text-white font-semibold">{stats.totalCorrect}/{stats.totalCompleted} correct</span>
                                        <span className="text-blue-200">({stats.accuracy}%)</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Next Challenge Countdown */}
                        {hasAnswered && (
                            <div className="mb-8">
                                <NextChallengeCallout nextChallengeTime={nextChallengeTime} />
                            </div>
                        )}

                        {/* Call to Action */}
                        <div className="text-center">
                            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-lg border-2 border-white/30 group-hover:bg-white/30 transition-all">
                                <span className="text-white font-semibold text-lg">
                                    {hasAnswered ? 'View Leaderboard' : 'Take the Challenge'}
                                </span>
                                <svg className="w-6 h-6 text-white transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    )
}
