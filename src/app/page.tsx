import Link from 'next/link'
import type { Metadata } from 'next'
import { getAppUser } from '@/lib/clerk-auth'
import { prisma } from '@/lib/prisma'
import HomepageClient from './HomepageClient'
import DailyChallengeCardClient from './components/DailyChallengeCardClient'
import OnboardingTour from './components/OnboardingTour'
import { getActiveChallengeDate } from '@/lib/daily-challenge-utils'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
    alternates: {
        canonical: 'https://trivrdy.com',
    },
}

async function getDailyChallenge(userId: string | null) {
    try {
        // Get the active challenge date (based on 9AM ET boundary)
        const challengeDate = getActiveChallengeDate()
        
        // Check if challenge exists for today
        const challenge = await prisma.dailyChallenge.findUnique({
            where: { date: challengeDate },
            include: {
                question: {
                    include: {
                        category: true
                    }
                }
            }
        })

        // If no challenge exists, we'll let the API handle creation on first request
        // For now, just return null to avoid blocking the page
        if (!challenge) {
            return null
        }

        // Get user's answer if authenticated
        let userAnswer = null
        if (userId) {
            const userChallenge = await prisma.userDailyChallenge.findUnique({
                where: {
                    userId_challengeId: {
                        userId: userId,
                        challengeId: challenge.id
                    }
                }
            })
            if (userChallenge) {
                userAnswer = {
                    correct: userChallenge.correct,
                    completedAt: userChallenge.completedAt
                }
            }
        }

        return {
            id: challenge.id,
            date: challenge.date.toISOString(),
            question: {
                id: challenge.question.id,
                question: challenge.question.question,
                answer: challenge.question.answer,
                category: challenge.question.category.name,
                airDate: challenge.question.airDate?.toISOString() ?? null
            },
            userAnswer: userAnswer ? {
                correct: userAnswer.correct,
                completedAt: userAnswer.completedAt.toISOString()
            } : null
        }
    } catch (error) {
        console.error('Error fetching daily challenge:', error)
        return null
    }
}

async function getDailyChallengeStats(userId: string | null) {
    if (!userId) return null
    
    try {
        const userChallenges = await prisma.userDailyChallenge.findMany({
            where: { userId },
            include: {
                challenge: {
                    include: {
                        question: {
                            include: {
                                category: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                challenge: {
                    date: 'desc'
                }
            }
        })

        const totalCompleted = userChallenges.length
        const totalCorrect = userChallenges.filter(uc => uc.correct).length
        const accuracy = totalCompleted > 0 ? Math.round((totalCorrect / totalCompleted) * 100) : 0

        // Compute participation streaks
        let currentParticipationStreak = 0
        let longestParticipationStreak = 0
        let tempParticipationStreak = 0
        let lastParticipationDate: Date | null = null

        const sortedChallenges = [...userChallenges].sort((a, b) => {
            const dateA = new Date(a.challenge.date)
            const dateB = new Date(b.challenge.date)
            return dateA.getTime() - dateB.getTime()
        })

        for (const userChallenge of sortedChallenges) {
            const challengeDate = new Date(userChallenge.challenge.date)
            challengeDate.setHours(0, 0, 0, 0)

            if (lastParticipationDate === null) {
                tempParticipationStreak = 1
                currentParticipationStreak = 1
            } else {
                const lastDate = new Date(lastParticipationDate)
                lastDate.setHours(0, 0, 0, 0)
                const daysDiff = Math.floor((challengeDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

                if (daysDiff === 1) {
                    tempParticipationStreak++
                } else {
                    tempParticipationStreak = 1
                }
            }

            if (userChallenge === sortedChallenges[sortedChallenges.length - 1]) {
                currentParticipationStreak = tempParticipationStreak
            }

            if (tempParticipationStreak > longestParticipationStreak) {
                longestParticipationStreak = tempParticipationStreak
            }

            lastParticipationDate = challengeDate
        }

        return {
            participationStreak: {
                current: currentParticipationStreak,
                longest: longestParticipationStreak
            },
            correctnessStreak: {
                current: 0,
                longest: 0
            },
            totalCompleted,
            totalCorrect,
            accuracy
        }
    } catch (error) {
        console.error('Error fetching daily challenge stats:', error)
        return null
    }
}

export default async function Home() {
    // Fetch user on the server - no flash, immediate render
    const user = await getAppUser()
    
    // Fetch all data server-side to avoid client-side waterfall
    const [dailyChallenge, dailyChallengeStats] = await Promise.all([
        getDailyChallenge(user?.id || null),
        getDailyChallengeStats(user?.id || null)
    ])

    // Get tour state from user (already fetched above)
    const tourState = user ? {
        hasSeenTour: user.hasSeenTour,
        tourCompleted: user.tourCompleted,
        tourDismissed: user.tourDismissed,
        tourDismissedAt: user.tourDismissedAt?.toISOString() || null
    } : null

    return (
        <div className="relative flex-1 w-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-amber-50/70">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/50 via-transparent to-transparent" />

            <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-8 sm:pb-14">
                {/* Hero Header */}
                <div className="text-center max-w-3xl mx-auto">
                    <h1>
                        <span className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl block tracking-tight">
                            Study Jeopardy with
                        </span>
                        <span
                            className="text-5xl sm:text-6xl font-medium bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent block mt-1.5 pb-1 tracking-tight"
                            style={{ fontFamily: 'var(--font-fredoka), sans-serif' }}
                        >
                            trivrdy
                        </span>
                    </h1>
                    <p className="mt-3 max-w-xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
                        Practice with real Jeopardy questions, see how you stack up, and get better over time.
                    </p>

                    {/* Quick stats */}
                    <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>12,000+ Questions</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            <span>6 Categories</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span>Track Progress</span>
                        </div>
                    </div>
                </div>

                {/* Onboarding Tour - pass initial state from server */}
                <OnboardingTour userId={user?.id} initialTourState={tourState} />

                {/* Daily Challenge Card */}
                <div id="daily-challenge-card" className="mt-6 sm:mt-8 max-w-4xl mx-auto">
                    <DailyChallengeCardClient challenge={dailyChallenge} stats={dailyChallengeStats} />
                </div>

                {/* Mode Cards */}
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
                    <div id="play-game-card">
                        <HomepageClient user={user} mode="game" />
                    </div>

                    <div id="practice-card">
                        <HomepageClient user={user} mode="practice" />
                    </div>
                </div>

                {/* Guest Sign In Prompt */}
                {!user && (
                    <div className="mt-10 max-w-2xl mx-auto rounded-2xl border border-slate-200 bg-white/90 p-6 sm:p-8 text-center shadow-sm">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-100 text-amber-900 rounded-full text-xs font-semibold uppercase tracking-wide mb-3">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Unlock all features
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">Track Your Progress</h2>
                        <p className="mt-2 max-w-lg mx-auto text-sm sm:text-base text-slate-600">
                            Sign in to save your progress, compete on the leaderboard, and get
                            personalized recommendations based on your performance.
                        </p>
                        <Link
                            href="/sign-in"
                            className="mt-5 inline-flex items-center gap-2 btn-primary btn-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Sign In
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
