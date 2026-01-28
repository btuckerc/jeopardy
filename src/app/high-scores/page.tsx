import Link from 'next/link';
import { getAppUser } from '@/lib/clerk-auth';
import { prisma } from '@/lib/prisma';
import HighScoresClient from './HighScoresClient';
import { Metadata } from 'next';
import type { GameConfig } from '@/types/game';

export const metadata: Metadata = {
    title: 'High Scores | Top Jeopardy Game Scores | trivrdy',
    description: 'See the highest single-game scores achieved by trivia champions. View the top Jeopardy game scores and compete for the best performance.',
    keywords: 'jeopardy high scores, trivia high scores, top game scores, jeopardy records, trivia competition, best jeopardy scores',
    openGraph: {
        title: 'High Scores | Top Jeopardy Game Scores | trivrdy',
        description: 'See the highest single-game scores achieved by trivia champions. View the top Jeopardy game scores and compete for the best performance.',
        url: 'https://trivrdy.com/high-scores',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'High Scores | Top Jeopardy Game Scores | trivrdy',
        description: 'See the highest single-game scores achieved by trivia champions.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/high-scores',
    },
};

interface HighScoreEntry {
    id: string;
    rank: number;
    userId: string;
    displayName: string;
    selectedIcon: string | null;
    avatarBackground: string | null;
    score: number;
    gameMode: string;
    roundsPlayed: string[];
    questionsCorrect: number;
    questionsTotal: number;
    accuracy: number;
    completedAt: string;
    seed: string | null;
}

/**
 * Get a human-readable game mode label
 */
function getGameModeLabel(config: GameConfig | null): string {
    if (!config?.mode) return 'Classic';
    
    switch (config.mode) {
        case 'random':
            return 'Random';
        case 'knowledge':
            const areas = config.categories || [];
            if (areas.length === 1) {
                return areas[0].replace(/_/g, ' ').split(' ').map(
                    (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                ).join(' ');
            }
            return `${areas.length} Knowledge Areas`;
        case 'custom':
            return 'Custom Categories';
        case 'date':
            if (config.date) {
                const [year, month, day] = config.date.split('-').map(Number);
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${months[month - 1]} ${day}, ${year}`;
            }
            return 'Date Mode';
        default:
            return 'Classic';
    }
}

/**
 * Get rounds played from config
 */
function getRoundsPlayed(config: GameConfig | null): string[] {
    const rounds: string[] = [];
    if (!config?.rounds) {
        rounds.push('Single', 'Double');
    } else {
        if (config.rounds.single) rounds.push('Single');
        if (config.rounds.double) rounds.push('Double');
        if (config.rounds.final) rounds.push('Final');
    }
    return rounds;
}

/**
 * High Scores page - Server component that fetches data and handles auth.
 */
export default async function HighScoresPage() {
    const user = await getAppUser();

    // Not signed in - show sign in prompt
    if (!user) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-md mx-auto">
                    <div className="card text-center p-8">
                        <div className="flex justify-center mb-4">
                            <svg className="w-16 h-16 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">View High Scores</h1>
                        <p className="text-gray-600 mb-6">Sign in to see the top single-game scores and compete for the best performance.</p>
                        <Link href="/sign-in?redirect_url=/high-scores" className="btn-primary inline-flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Fetch high scores data server-side
    let highScores: HighScoreEntry[] = [];
    let userBestGame: HighScoreEntry | null = null;
    let userBestRank: number | null = null;

    try {
        // Fetch top 50 high scores
        const games = await prisma.game.findMany({
            where: {
                status: 'COMPLETED',
                currentScore: { gt: 0 }
            },
            orderBy: {
                currentScore: 'desc'
            },
            take: 50,
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        selectedIcon: true,
                        avatarBackground: true
                    }
                },
                questions: {
                    select: {
                        answered: true,
                        correct: true
                    }
                }
            }
        });

        highScores = games.map((game, index) => {
            const config = game.config as GameConfig | null;
            const questionsTotal = game.questions.filter(q => q.answered).length;
            const questionsCorrect = game.questions.filter(q => q.correct === true).length;
            const accuracy = questionsTotal > 0 
                ? Math.round((questionsCorrect / questionsTotal) * 100)
                : 0;

            return {
                id: game.id,
                rank: index + 1,
                userId: game.userId,
                displayName: game.user.displayName || 'Anonymous Player',
                selectedIcon: game.user.selectedIcon,
                avatarBackground: game.user.avatarBackground,
                score: game.currentScore,
                gameMode: getGameModeLabel(config),
                roundsPlayed: getRoundsPlayed(config),
                questionsCorrect,
                questionsTotal,
                accuracy,
                completedAt: game.updatedAt.toISOString(),
                seed: game.seed
            };
        });

        // Find user's best game
        const userBest = highScores.find(entry => entry.userId === user.id);
        if (userBest) {
            userBestGame = userBest;
            userBestRank = userBest.rank;
        } else {
            // User's best game might not be in top 50, fetch it separately
            const userBestFromDb = await prisma.game.findFirst({
                where: {
                    userId: user.id,
                    status: 'COMPLETED',
                    currentScore: { gt: 0 }
                },
                orderBy: {
                    currentScore: 'desc'
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            displayName: true,
                            selectedIcon: true,
                            avatarBackground: true
                        }
                    },
                    questions: {
                        select: {
                            answered: true,
                            correct: true
                        }
                    }
                }
            });

            if (userBestFromDb) {
                const config = userBestFromDb.config as GameConfig | null;
                const questionsTotal = userBestFromDb.questions.filter(q => q.answered).length;
                const questionsCorrect = userBestFromDb.questions.filter(q => q.correct === true).length;
                const accuracy = questionsTotal > 0 
                    ? Math.round((questionsCorrect / questionsTotal) * 100)
                    : 0;

                // Find rank by counting games with higher scores
                const higherScoreCount = await prisma.game.count({
                    where: {
                        status: 'COMPLETED',
                        currentScore: { gt: userBestFromDb.currentScore }
                    }
                });

                userBestRank = higherScoreCount + 1;
                userBestGame = {
                    id: userBestFromDb.id,
                    rank: userBestRank,
                    userId: userBestFromDb.userId,
                    displayName: userBestFromDb.user.displayName || 'Anonymous Player',
                    selectedIcon: userBestFromDb.user.selectedIcon,
                    avatarBackground: userBestFromDb.user.avatarBackground,
                    score: userBestFromDb.currentScore,
                    gameMode: getGameModeLabel(config),
                    roundsPlayed: getRoundsPlayed(config),
                    questionsCorrect,
                    questionsTotal,
                    accuracy,
                    completedAt: userBestFromDb.updatedAt.toISOString(),
                    seed: userBestFromDb.seed
                };
            }
        }
    } catch (error) {
        console.error('Error fetching high scores:', error);
        // Continue with empty high scores
    }

    return (
        <HighScoresClient 
            user={user} 
            initialHighScores={highScores}
            userBestGame={userBestGame}
            userBestRank={userBestRank}
        />
    );
}
