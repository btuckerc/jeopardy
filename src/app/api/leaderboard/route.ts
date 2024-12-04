import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get all users with their stats
        const userStats = await prisma.$queryRaw`
            WITH UserStats AS (
                SELECT 
                    u.id,
                    u."displayName",
                    u."selectedIcon",
                    COUNT(DISTINCT CASE WHEN gh.correct = true THEN gh."questionId" END)::integer as correct_answers,
                    COUNT(DISTINCT gh."questionId")::integer as total_answered,
                    COALESCE(SUM(CASE WHEN gh.correct = true THEN gh.points ELSE 0 END), 0)::integer as total_points
                FROM "User" u
                LEFT JOIN "GameHistory" gh ON u.id = gh."userId"
                GROUP BY u.id, u."displayName", u."selectedIcon"
                HAVING COALESCE(SUM(CASE WHEN gh.correct = true THEN gh.points ELSE 0 END), 0) > 0
            )
            SELECT 
                id,
                COALESCE("displayName", 'Anonymous Player') as "displayName",
                "selectedIcon",
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
            LIMIT 10
        ` as Array<{
            id: string;
            displayName: string;
            selectedIcon: string | null;
            correctAnswers: number;
            totalAnswered: number;
            totalPoints: number;
            avgPointsPerCorrect: number;
        }>;

        return NextResponse.json(userStats);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch leaderboard' },
            { status: 500 }
        );
    }
} 