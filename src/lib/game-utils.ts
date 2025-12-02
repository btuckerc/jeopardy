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

/**
 * Check if a date is a weekday (Monday-Friday)
 * Jeopardy typically airs on weekdays, though special episodes may air on weekends
 */
export function isWeekday(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/**
 * Check if a date is eligible for use as a daily challenge source
 * Considers:
 * - Minimum age from today (spoiler protection)
 * - Whether it's a weekday (Jeopardy typically airs Mon-Fri)
 * - Whether questions exist for that date in the database (optional check)
 * 
 * @param airDate The historical air date to check
 * @param today The current date (defaults to now)
 * @param minAgeDays Minimum age in days from today (default: 730 = 2 years)
 * @param requireWeekday Whether to require weekday (default: false, as some specials air on weekends)
 * @param checkDatabase Whether to check if questions exist in DB (default: false)
 */
export async function isEligibleAirDate(
    airDate: Date,
    today: Date = new Date(),
    minAgeDays: number = 730,
    requireWeekday: boolean = false,
    checkDatabase: boolean = false
): Promise<{ eligible: boolean; reason?: string }> {
    // Check minimum age
    const ageInDays = Math.floor((today.getTime() - airDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays < minAgeDays) {
        return { eligible: false, reason: `Air date is too recent (${ageInDays} days old, need ${minAgeDays})` };
    }

    // Check if it's a weekday (optional)
    if (requireWeekday && !isWeekday(airDate)) {
        return { eligible: false, reason: 'Air date is not a weekday' };
    }

    // Check if questions exist in database (optional)
    if (checkDatabase) {
        const questionCount = await prisma.question.count({
            where: {
                round: 'FINAL',
                airDate: {
                    gte: new Date(airDate.getFullYear(), airDate.getMonth(), airDate.getDate()),
                    lt: new Date(airDate.getFullYear(), airDate.getMonth(), airDate.getDate() + 1)
                }
            }
        });

        if (questionCount === 0) {
            return { eligible: false, reason: 'No Final Jeopardy questions found for this date in database' };
        }
    }

    return { eligible: true };
}

/**
 * Get the next eligible weekday date for backfilling
 * Useful when we need to find dates to fetch from J-Archive
 */
export function getNextEligibleWeekday(startDate: Date, daysBack: number = 0): Date {
    const targetDate = new Date(startDate);
    targetDate.setDate(targetDate.getDate() - daysBack);
    
    // If it's already a weekday, return it
    if (isWeekday(targetDate)) {
        return targetDate;
    }
    
    // Otherwise, find the previous weekday
    while (!isWeekday(targetDate)) {
        targetDate.setDate(targetDate.getDate() - 1);
    }
    
    return targetDate;
} 