import { PrismaClient, Prisma } from '@prisma/client';
import { GameHistory, UserProgress } from '../types/models';

const prisma = new PrismaClient();

interface StatsAccumulator {
    correct: number;
    total: number;
    points: number;
}

export async function updateGameHistory({
    userId,
    questionId,
    correct,
    points,
}: {
    userId: string;
    questionId: string;
    correct: boolean;
    points: number;
}): Promise<{ gameHistory: GameHistory; userProgress: UserProgress }> {
    try {
        // Start a transaction to ensure both updates succeed or fail together
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Create game history entry
            const gameHistory = await tx.gameHistory.create({
                data: {
                    userId,
                    questionId,
                    correct,
                    points,
                },
            });

            // Get the question to find its category
            const question = await tx.question.findUnique({
                where: { id: questionId },
                select: { categoryId: true },
            });

            if (!question) {
                throw new Error('Question not found');
            }

            // Update or create user progress
            const userProgress = await tx.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId,
                        categoryId: question.categoryId,
                    },
                },
                update: {
                    correct: { increment: correct ? 1 : 0 },
                    total: { increment: 1 },
                    points: { increment: points },
                },
                create: {
                    userId,
                    categoryId: question.categoryId,
                    questionId,
                    correct: correct ? 1 : 0,
                    total: 1,
                    points,
                },
            });

            return { gameHistory, userProgress };
        });

        return result;
    } catch (error) {
        console.error('Error updating game history:', error);
        throw error;
    }
}

export async function getUserStats(userId: string) {
    try {
        const stats = await prisma.userProgress.findMany({
            where: { userId },
            include: {
                category: true,
            },
        });

        const totalStats = stats.reduce<StatsAccumulator>(
            (acc: StatsAccumulator, curr) => ({
                correct: acc.correct + curr.correct,
                total: acc.total + curr.total,
                points: acc.points + curr.points,
            }),
            { correct: 0, total: 0, points: 0 }
        );

        return {
            categoryStats: stats,
            totalStats,
            accuracy: totalStats.total > 0 ? (totalStats.correct / totalStats.total) * 100 : 0,
        };
    } catch (error) {
        console.error('Error fetching user stats:', error);
        throw error;
    }
}

export async function getRecentGames(userId: string, limit = 10) {
    try {
        return await prisma.game.findMany({
            where: {
                userId,
                completed: true,
            },
            orderBy: {
                updatedAt: 'desc',
            },
            take: limit,
            include: {
                questions: {
                    include: {
                        question: {
                            include: {
                                category: true,
                            },
                        },
                    },
                },
            },
        });
    } catch (error) {
        console.error('Error fetching recent games:', error);
        throw error;
    }
} 