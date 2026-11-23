import { getAppUser } from '@/lib/clerk-auth'
import { prisma } from '@/lib/prisma'
import { getGuestConfig } from '@/lib/guest-sessions'
import DailyChallengeClient from './DailyChallengeClient'
import { Metadata } from 'next'
import { ensureOriginalDailyChallenge } from '../api/daily-challenge/route'
import { getActiveChallengeDate } from '@/lib/daily-challenge-utils'
import { JsonLd } from '@/components/JsonLd'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Daily Trivia Challenge | New Jeopardy Question - trivrdy',
    description: 'Test your knowledge with today\'s Daily Challenge - a new Final Jeopardy question every day. Compete with others and track your streak.',
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: 'Daily Trivia Challenge | New Jeopardy Question - trivrdy',
        description: 'Test your knowledge with today\'s Daily Challenge - a new Final Jeopardy question every day.',
        url: 'https://trivrdy.com/daily-challenge',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Daily Trivia Challenge | New Jeopardy Question - trivrdy',
        description: 'Test your knowledge with today\'s Daily Challenge - a new Final Jeopardy question every day.',
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

    let challengeQuestionSource: string | null = null
    try {
        // Get the active challenge date (based on 9AM ET boundary)
        const challengeDate = getActiveChallengeDate()

        // Get or rotate today's challenge so pre-generated unplayed legacy rows switch to ORIGINAL_ENGINE
        const challengeData = await ensureOriginalDailyChallenge(challengeDate)

        if (challengeData) {
            challengeQuestionSource = challengeData.question.source
            const isAdmin = user?.role === 'ADMIN'
            // Fetch user answer, guest config, and leaderboard in parallel
            const [userChallenge, guestConfig, completions] = await Promise.all([
                user
                    ? prisma.userDailyChallenge.findUnique({
                        where: {
                            userId_challengeId: {
                                userId: user.id,
                                challengeId: challengeData.id
                            }
                        }
                    })
                    : Promise.resolve(null),
                getGuestConfig(),
                prisma.userDailyChallenge.findMany({
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
            ])

            const userAnswer = userChallenge
                ? {
                    correct: userChallenge.correct,
                    completedAt: userChallenge.completedAt.toISOString(),
                    userAnswerText: userChallenge.userAnswer || null
                }
                : null

            // Mirror GET /api/daily-challenge mid-day cutover guard:
            // never render a non-published or LEGACY_JEOPARDY clue/answer in SSR HTML or JSON-LD
            // to non-admin users who did not already participate before cutover.
            const canExposeChallenge =
                isAdmin ||
                Boolean(userAnswer) ||
                (challengeData.question.source === 'ORIGINAL_ENGINE' &&
                    challengeData.question.publishStatus === 'PUBLISHED')

            if (canExposeChallenge) {
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
        }
    } catch (error) {
        console.error('Error fetching daily challenge:', error)
        // Continue with null challenge - client will handle error state
    }

    // Build QAPage schema for SEO (only if we have a challenge)
    const qaPageSchema = challenge ? {
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        mainEntity: {
            '@type': 'Question',
            name: challenge.question.question.length > 150
                ? challenge.question.question.substring(0, 150) + '...'
                : challenge.question.question,
            text: challenge.question.question,
            answer: {
                '@type': 'Answer',
                text: challenge.question.answer,
            },
            author: {
                '@type': 'Organization',
                name: challengeQuestionSource === 'ORIGINAL_ENGINE' ? 'trivrdy' : 'Jeopardy!',
            },
            datePublished: challenge.question.airDate || challenge.date,
            about: {
                '@type': 'Thing',
                name: challenge.question.category,
            },
        },
    } : null

    // Breadcrumb schema
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: 'https://trivrdy.com',
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Daily Challenge',
                item: 'https://trivrdy.com/daily-challenge',
            },
        ],
    }

    return (
        <>
            {qaPageSchema && <JsonLd data={qaPageSchema} />}
            <JsonLd data={breadcrumbSchema} />
            <DailyChallengeClient
                initialChallenge={challenge}
                initialLeaderboard={leaderboard}
                user={user}
            />
        </>
    )
}
