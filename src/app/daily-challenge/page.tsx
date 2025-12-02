import { getAppUser } from '@/lib/clerk-auth'
import { prisma } from '@/lib/prisma'
import { getGuestConfig } from '@/lib/guest-sessions'
import DailyChallengeClient from './DailyChallengeClient'
import { Metadata } from 'next'
import { setupDailyChallenge } from '../api/daily-challenge/route'

export const metadata: Metadata = {
    title: 'Daily Challenge | trivrdy',
    description: 'Test your knowledge with today\'s Daily Challenge - a Final Jeopardy question from Jeopardy history.',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: 'Daily Challenge | trivrdy',
        description: 'Test your knowledge with today\'s Daily Challenge.',
        url: 'https://trivrdy.com/daily-challenge',
        type: 'website',
    },
    alternates: {
        canonical: 'https://trivrdy.com/daily-challenge',
    },
}

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
        userAnswerText?: string | null
    } | null
    guestConfig?: {
        guestEnabled: boolean
        guestAppearsOnLeaderboard: boolean
    }
}

interface LeaderboardEntry {
    rank: number
    userId: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    correct: boolean
    completedAt: string
}

/**
 * Daily Challenge page - Server component that fetches initial data
 * 
 * By fetching data server-side:
 * 1. The page loads with data already populated (no loading splash screen)
 * 2. Better SEO and initial page load performance
 * 3. User sees content immediately
 */
export default async function DailyChallengePage() {
    const user = await getAppUser()
    
    // Fetch challenge data server-side
    let challenge: DailyChallenge | null = null
    let leaderboard: LeaderboardEntry[] = []
    
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Get today's challenge, create if it doesn't exist
        let challengeData = await prisma.dailyChallenge.findUnique({
            where: { date: today },
            include: {
                question: {
                    include: {
                        category: true
                    }
                }
            }
        })

        // If no challenge exists, try to create one (may fail if no questions available)
        if (!challengeData) {
            try {
                const createdChallenge = await setupDailyChallenge(today)
                if (createdChallenge) {
                    challengeData = createdChallenge
                } else {
                    // Setup returned null, try fetching anyway (might have been created by another request)
                    challengeData = await prisma.dailyChallenge.findUnique({
                        where: { date: today },
                        include: {
                            question: {
                                include: {
                                    category: true
                                }
                            }
                        }
                    })
                }
            } catch (error: any) {
                // If it's a unique constraint error, challenge was created by another request
                if (error.code === 'P2002') {
                    challengeData = await prisma.dailyChallenge.findUnique({
                        where: { date: today },
                        include: {
                            question: {
                                include: {
                                    category: true
                                }
                            }
                        }
                    })
                } else {
                    console.error('Error setting up daily challenge:', error)
                }
            }
        }

        if (challengeData) {
            // Get user's answer if authenticated
            let userAnswer = null
            if (user) {
                const userChallenge = await prisma.userDailyChallenge.findUnique({
                    where: {
                        userId_challengeId: {
                            userId: user.id,
                            challengeId: challengeData.id
                        }
                    }
                })
                if (userChallenge) {
                    userAnswer = {
                        correct: userChallenge.correct,
                        completedAt: userChallenge.completedAt.toISOString(),
                        userAnswerText: userChallenge.userAnswer || null
                    }
                }
            }

            // Get guest config
            const guestConfig = await getGuestConfig()

            challenge = {
                id: challengeData.id,
                date: challengeData.date.toISOString(),
                question: {
                    id: challengeData.question.id,
                    question: challengeData.question.question,
                    answer: challengeData.question.answer,
                    category: challengeData.question.category.name,
                    airDate: challengeData.question.airDate?.toISOString() || null
                },
                userAnswer,
                guestConfig: {
                    guestEnabled: guestConfig.dailyChallengeGuestEnabled,
                    guestAppearsOnLeaderboard: guestConfig.dailyChallengeGuestAppearsOnLeaderboard
                }
            }

            // Fetch leaderboard data server-side
            const completions = await prisma.userDailyChallenge.findMany({
                where: { challengeId: challengeData.id },
                include: {
                    user: {
                        select: {
                            id: true,
                            displayName: true,
                            selectedIcon: true,
                            avatarBackground: true
                        }
                    }
                },
                orderBy: [
                    { correct: 'desc' },
                    { completedAt: 'asc' }
                ]
            })

            leaderboard = completions.map((completion, index) => ({
                rank: index + 1,
                userId: completion.user.id,
                displayName: completion.user.displayName || 'Anonymous',
                selectedIcon: completion.user.selectedIcon,
                avatarBackground: completion.user.avatarBackground,
                correct: completion.correct,
                completedAt: completion.completedAt.toISOString()
            }))
        }
    } catch (error) {
        console.error('Error fetching daily challenge:', error)
        // Continue with null challenge - client will handle error state
    }

    return <DailyChallengeClient 
        initialChallenge={challenge} 
        initialLeaderboard={leaderboard}
        user={user}
    />
}
