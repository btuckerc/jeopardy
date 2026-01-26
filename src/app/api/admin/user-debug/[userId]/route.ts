import { jsonResponse, serverErrorResponse, requireAdmin, notFoundResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/user-debug/[userId]
 * Get comprehensive debug view of a single user's state
 */
export async function GET(
    request: Request,
    { params }: { params: { userId: string } }
) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const { userId } = params

        // Fetch user with all related data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                clerkUserId: true,
                email: true,
                name: true,
                displayName: true,
                selectedIcon: true,
                avatarBackground: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                lastOnlineAt: true,
                lastSeenPath: true,
                currentStreak: true,
                longestStreak: true,
                lastGameDate: true,
                spoilerBlockEnabled: true,
                spoilerBlockDate: true,
                lastSpoilerPrompt: true,
            },
        })

        if (!user) {
            return notFoundResponse('User not found')
        }

        // Fetch related data in parallel
        const [
            games,
            recentGameHistory,
            dailyChallenges,
            achievements,
            disputes,
            issueReports,
            claimedGuestSessions,
        ] = await Promise.all([
            // Games (in-progress and recent)
            prisma.game.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    seed: true,
                    status: true,
                    currentRound: true,
                    currentScore: true,
                    score: true,
                    completed: true,
                    createdAt: true,
                    updatedAt: true,
                    config: true,
                    _count: {
                        select: {
                            questions: true,
                        },
                    },
                },
            }),

            // Recent game history (last 50 answers)
            prisma.gameHistory.findMany({
                where: { userId },
                orderBy: { timestamp: 'desc' },
                take: 50,
                select: {
                    id: true,
                    correct: true,
                    points: true,
                    userAnswer: true,
                    timestamp: true,
                    question: {
                        select: {
                            id: true,
                            question: true,
                            answer: true,
                            value: true,
                            category: {
                                select: { name: true },
                            },
                        },
                    },
                },
            }),

            // Daily challenge completions (last 30)
            prisma.userDailyChallenge.findMany({
                where: { userId },
                orderBy: { completedAt: 'desc' },
                take: 30,
                select: {
                    id: true,
                    correct: true,
                    userAnswer: true,
                    completedAt: true,
                    challenge: {
                        select: {
                            date: true,
                            question: {
                                select: {
                                    question: true,
                                    answer: true,
                                },
                            },
                        },
                    },
                },
            }),

            // Achievements
            prisma.userAchievement.findMany({
                where: { userId },
                orderBy: { unlockedAt: 'desc' },
                select: {
                    unlockedAt: true,
                    achievement: {
                        select: {
                            code: true,
                            name: true,
                            description: true,
                            category: true,
                            tier: true,
                        },
                    },
                },
            }),

            // Disputes (all)
            prisma.answerDispute.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    status: true,
                    mode: true,
                    userAnswer: true,
                    systemWasCorrect: true,
                    adminComment: true,
                    createdAt: true,
                    resolvedAt: true,
                    question: {
                        select: {
                            question: true,
                            answer: true,
                        },
                    },
                },
            }),

            // Issue reports
            prisma.issueReport.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    subject: true,
                    category: true,
                    status: true,
                    createdAt: true,
                    resolvedAt: true,
                },
            }),

            // Claimed guest sessions
            prisma.guestSession.findMany({
                where: { claimedByUserId: userId },
                orderBy: { claimedAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    type: true,
                    createdAt: true,
                    claimedAt: true,
                },
            }),
        ])

        // Calculate aggregate stats
        const gameStats = {
            total: games.length,
            inProgress: games.filter(g => g.status === 'IN_PROGRESS').length,
            completed: games.filter(g => g.status === 'COMPLETED').length,
            abandoned: games.filter(g => g.status === 'ABANDONED').length,
        }

        const dailyChallengeStats = {
            total: dailyChallenges.length,
            correct: dailyChallenges.filter(dc => dc.correct).length,
            accuracy: dailyChallenges.length > 0
                ? (dailyChallenges.filter(dc => dc.correct).length / dailyChallenges.length) * 100
                : 0,
        }

        const disputeStats = {
            total: disputes.length,
            pending: disputes.filter(d => d.status === 'PENDING').length,
            approved: disputes.filter(d => d.status === 'APPROVED').length,
            rejected: disputes.filter(d => d.status === 'REJECTED').length,
        }

        const recentHistoryStats = {
            total: recentGameHistory.length,
            correct: recentGameHistory.filter(h => h.correct).length,
            accuracy: recentGameHistory.length > 0
                ? (recentGameHistory.filter(h => h.correct).length / recentGameHistory.length) * 100
                : 0,
            totalPoints: recentGameHistory.reduce((sum, h) => sum + h.points, 0),
        }

        return jsonResponse({
            user,
            stats: {
                games: gameStats,
                dailyChallenges: dailyChallengeStats,
                disputes: disputeStats,
                recentHistory: recentHistoryStats,
                achievementsUnlocked: achievements.length,
            },
            recentActivity: {
                games: games.map(g => ({
                    ...g,
                    questionCount: g._count.questions,
                })),
                gameHistory: recentGameHistory,
                dailyChallenges,
                achievements,
                disputes,
                issueReports,
                claimedGuestSessions,
            },
        })
    } catch (error) {
        return serverErrorResponse('Error fetching user debug info', error)
    }
}

