import Link from 'next/link';
import { getAppUser } from '@/lib/clerk-auth';
import { prisma } from '@/lib/prisma';
import { FINAL_STATS_CLUE_VALUE, DEFAULT_STATS_CLUE_VALUE } from '@/lib/scoring';
import LeaderboardClient from './LeaderboardClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Trivia Rankings & Leaderboard | Jeopardy Stats | trivrdy',
    description: 'See how you rank against other trivia champions. View the global leaderboard, track your Jeopardy stats, and compete for the top spot.',
    keywords: 'trivia leaderboard, jeopardy rankings, trivia stats, jeopardy leaderboard, trivia competition, jeopardy scores',
    openGraph: {
        title: 'Trivia Rankings & Leaderboard | Jeopardy Stats | trivrdy',
        description: 'See how you rank against other trivia champions. View the global leaderboard, track your Jeopardy stats, and compete for the top spot.',
        url: 'https://trivrdy.com/leaderboard',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Trivia Rankings & Leaderboard | trivrdy',
        description: 'See how you rank against other trivia champions. View the global leaderboard and compete for the top spot.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/leaderboard',
    },
};

interface LeaderboardEntry {
    id: string;
    displayName: string;
    selectedIcon: string | null;
    avatarBackground: string | null;
    correctAnswers: number;
    totalAnswered: number;
    totalPoints: number;
    avgPointsPerCorrect: number;
}

/**
 * Leaderboard page - Server component that fetches data and handles auth.
 * 
 * By fetching data server-side:
 * 1. The page loads with data already populated (no loading spinner)
 * 2. router.refresh() from settings will refetch this data
 * 3. Display name changes are immediately reflected
 */
export default async function LeaderboardPage() {
    const user = await getAppUser();

    // Not signed in - show sign in prompt
    if (!user) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-md mx-auto">
                    <div className="card text-center p-8">
                        <div className="flex justify-center mb-4">
                            <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">View the Leaderboard</h1>
                        <p className="text-gray-600 mb-6">Sign in to see how you rank against other trivia champions.</p>
                        <Link href="/sign-in" className="btn-primary inline-flex items-center gap-2">
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

    // Fetch leaderboard data server-side
    let leaderboard: LeaderboardEntry[] = [];
    try {
        leaderboard = await prisma.$queryRaw<LeaderboardEntry[]>`
            WITH UserStats AS (
                SELECT 
                    u.id,
                    u."displayName",
                    u."selectedIcon",
                    u."avatarBackground",
                    COUNT(DISTINCT CASE WHEN gh.correct = true THEN gh."questionId" END)::integer as correct_answers,
                    COUNT(DISTINCT gh."questionId")::integer as total_answered,
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
                GROUP BY u.id, u."displayName", u."selectedIcon", u."avatarBackground"
                HAVING COALESCE(SUM(
                    CASE 
                        WHEN gh.correct = true AND q.round = 'FINAL' THEN ${FINAL_STATS_CLUE_VALUE}
                        WHEN gh.correct = true THEN COALESCE(q.value, ${DEFAULT_STATS_CLUE_VALUE})
                        ELSE 0 
                    END
                ), 0) > 0
            )
            SELECT 
                id,
                COALESCE("displayName", 'Anonymous Player') as "displayName",
                "selectedIcon",
                "avatarBackground",
                correct_answers as "correctAnswers",
                total_answered as "totalAnswered",
                total_points as "totalPoints",
                CASE 
                    WHEN correct_answers > 0 
                    THEN ROUND(CAST(total_points AS DECIMAL) / correct_answers, 2)::float
                    ELSE 0 
                END as "avgPointsPerCorrect"
            FROM UserStats
            ORDER BY total_points DESC
            LIMIT 100
        `;
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        // Continue with empty leaderboard
    }

    return <LeaderboardClient user={user} initialLeaderboard={leaderboard} />;
}
