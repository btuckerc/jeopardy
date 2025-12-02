import Link from 'next/link'
import { Fredoka } from 'next/font/google'
import { getAppUser } from '@/lib/clerk-auth'
import { prisma } from '@/lib/prisma'
import { FINAL_STATS_CLUE_VALUE, DEFAULT_STATS_CLUE_VALUE } from '@/lib/scoring'
import HomepageClient from './HomepageClient'
import DailyChallengeCard from './components/DailyChallengeCard'
import RecentActivityFeed from './components/RecentActivityFeed'

const fredoka = Fredoka({ weight: '300', subsets: ['latin'] })

async function getDailyChallenge(userId: string | null) {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Check if challenge exists for today
        let challenge = await prisma.dailyChallenge.findUnique({
            where: { date: today },
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

export default async function Home() {
    // Fetch user on the server - no flash, immediate render
    const user = await getAppUser()
    
    // Fetch daily challenge on the server
    const dailyChallenge = await getDailyChallenge(user?.id || null)
    
    // Fetch user activity stats if authenticated
    let activityStats = null
    if (user) {
        try {
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            weekAgo.setHours(0, 0, 0, 0)

            const gamesThisWeek = await prisma.game.count({
                where: {
                    userId: user.id,
                    createdAt: { gte: weekAgo },
                    status: 'COMPLETED'
                }
            })

            const bestGame = await prisma.game.findFirst({
                where: {
                    userId: user.id,
                    status: 'COMPLETED'
                },
                orderBy: { score: 'desc' },
                select: { score: true }
            })

            const userStats = await prisma.$queryRaw<Array<{
                id: string
                total_points: number
            }>>`
                SELECT 
                    u.id,
                    COALESCE(SUM(
                        CASE 
                            WHEN gh.correct = true AND q.round = 'FINAL' THEN ${FINAL_STATS_CLUE_VALUE}
                            WHEN gh.correct = true THEN COALESCE(q.value, ${DEFAULT_STATS_CLUE_VALUE})
                            ELSE 0 
                        END
                    ), 0)::integer as total_points
                FROM "User" u
                LEFT JOIN "GameHistory" gh ON u.id = gh."userId"
                LEFT JOIN "Question" q ON q.id = gh."questionId"
                GROUP BY u.id
                HAVING COALESCE(SUM(
                    CASE 
                        WHEN gh.correct = true AND q.round = 'FINAL' THEN ${FINAL_STATS_CLUE_VALUE}
                        WHEN gh.correct = true THEN COALESCE(q.value, ${DEFAULT_STATS_CLUE_VALUE})
                        ELSE 0 
                    END
                ), 0) > 0
                ORDER BY total_points DESC
            `

            const userRank = userStats.findIndex(u => u.id === user.id) + 1
            const totalPlayers = userStats.length

            activityStats = {
                gamesThisWeek,
                bestScore: bestGame?.score || 0,
                leaderboardRank: userRank > 0 ? userRank : null,
                totalPlayers
            }
        } catch (error) {
            console.error('Error fetching activity stats:', error)
        }
    }

    return (
        <>
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-amber-50 -z-10" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent -z-10" />

                {/* 
                    Use the shared `container` padding only (no extra px-4) so that
                    hero content, cards, and buttons line up symmetrically with the
                    navigation and footer on mobile.
                */}
                <div className="container mx-auto pt-8 pb-12 sm:pt-8 sm:pb-16">
                    {/* Header */}
                    <div className="text-center max-w-4xl mx-auto">
                        <h1>
                            <span className="text-3xl font-bold text-gray-900 sm:text-4xl lg:text-5xl block tracking-tight mb-4">
                                Study Jeopardy with
                            </span>
                            <span className={`${fredoka.className} text-5xl sm:text-6xl lg:text-7xl bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent block mt-8 pb-2`}>
                                trivrdy
                            </span>
                        </h1>
                        <p className="mt-8 max-w-2xl mx-auto text-xl text-gray-600 leading-relaxed">
                            Practice with real Jeopardy questions, <br className="hidden sm:block" />
                            see how you stack up, and get better over time.
                        </p>
                        
                        {/* Quick stats */}
                        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm sm:text-base text-gray-500 max-w-md mx-auto">
                            <div className="flex items-center gap-2">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>12,000+ Questions</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                                <span>6 Categories</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                <span>Track Progress</span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Stats (for authenticated users) */}
                    {user && activityStats && (
                        <div className="mt-8 flex flex-col items-center gap-6">
                            <RecentActivityFeed stats={activityStats} />
                        </div>
                    )}

                    {/* Daily Challenge Card */}
                    <div className="mt-8 max-w-4xl mx-auto">
                        <DailyChallengeCard challenge={dailyChallenge} />
                    </div>

                    {/* Mode Cards */}
                    <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 max-w-4xl mx-auto">
                        {/* Game Mode */}
                        <HomepageClient user={user} mode="game" />
                        
                        {/* Practice Mode */}
                        <HomepageClient user={user} mode="practice" />
                    </div>

                    {/* Guest Sign In Prompt */}
                    {!user && (
                        <div className="mt-8">
                            <div className="mt-8 text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium mb-4">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Unlock all features
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900">Track Your Progress</h2>
                                <p className="mt-3 max-w-xl mx-auto text-gray-600">
                                    Sign in to save your progress, compete on the leaderboard, and get 
                                    personalized recommendations based on your performance.
                                </p>
                                <Link 
                                    href="/sign-in"
                                    className="mt-6 inline-flex items-center gap-2 btn-primary btn-lg"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    Sign In
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </>
    )
}
