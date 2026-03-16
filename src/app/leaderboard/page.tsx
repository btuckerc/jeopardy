import Link from 'next/link';
import { getAppUser } from '@/lib/clerk-auth'
import { getLeaderboardEntries } from '@/lib/leaderboard'
import LeaderboardClient from './LeaderboardClient';
import { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
    title: 'Trivia Leaderboard | Rankings & Scores - trivrdy',
    description: 'Compete on the global trivia leaderboard. See how you rank against other Jeopardy champions, track your stats, and climb to the top spot.',
    keywords: 'trivia leaderboard, jeopardy rankings, trivia competition, jeopardy leaderboard, trivia scores, global rankings, trivia champions',
    openGraph: {
        title: 'Trivia Leaderboard | Rankings & Scores - trivrdy',
        description: 'Compete on the global trivia leaderboard. See how you rank against other Jeopardy champions.',
        url: 'https://trivrdy.com/leaderboard',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Trivia Leaderboard | Rankings & Scores - trivrdy',
        description: 'Compete on the global trivia leaderboard. See how you rank against other Jeopardy champions.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/leaderboard',
    },
};

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
            name: 'Leaderboard',
            item: 'https://trivrdy.com/leaderboard',
        },
    ],
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
interface LeaderboardPageProps {
    searchParams?: {
        scope?: 'global' | 'friends'
    }
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
    const user = await getAppUser();
    const scope = searchParams?.scope === 'friends' ? 'friends' : 'global'

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
                        <Link href="/sign-in?redirect_url=/leaderboard" className="btn-primary inline-flex items-center gap-2">
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
        leaderboard = await getLeaderboardEntries({
            limit: 100,
            scope,
            viewerUserId: scope === 'friends' ? user.id : undefined,
        })
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        // Continue with empty leaderboard
    }

    return (
        <>
            <JsonLd data={breadcrumbSchema} />
            <LeaderboardClient user={user} initialLeaderboard={leaderboard} scope={scope} />
        </>
    );
}
