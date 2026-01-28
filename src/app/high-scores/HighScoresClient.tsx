'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import type { AppUser } from '@/lib/clerk-auth';

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

interface HighScoresClientProps {
    user: AppUser;
    initialHighScores: HighScoreEntry[];
    userBestGame: HighScoreEntry | null;
    userBestRank: number | null;
}

type Timeframe = 'all' | 'week' | 'month' | 'year';

// Fetch function for React Query
async function fetchHighScores(timeframe: Timeframe): Promise<HighScoreEntry[]> {
    const response = await fetch(`/api/high-scores?limit=50&timeframe=${timeframe}`);
    if (!response.ok) {
        throw new Error('Failed to fetch high scores');
    }
    const data = await response.json();
    return data.highScores || [];
}

export default function HighScoresClient({ 
    user, 
    initialHighScores,
    userBestGame,
    userBestRank 
}: HighScoresClientProps) {
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [timeframe, setTimeframe] = useState<Timeframe>('all');
    const queryClient = useQueryClient();

    // Use React Query with stale-while-revalidate pattern
    const { data: highScores = initialHighScores, isLoading } = useQuery({
        queryKey: ['high-scores', timeframe],
        queryFn: () => fetchHighScores(timeframe),
        initialData: timeframe === 'all' ? initialHighScores : undefined,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
    });

    // Listen for user profile updates
    useEffect(() => {
        const handleProfileUpdate = () => {
            queryClient.invalidateQueries({ queryKey: ['high-scores'] });
        };

        window.addEventListener('user-profile-updated', handleProfileUpdate);
        return () => window.removeEventListener('user-profile-updated', handleProfileUpdate);
    }, [queryClient]);

    // Handle scroll to show/hide back to top button
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400);
        };
        
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    };

    // Find current user's entry in the list
    const userEntry = highScores.find(entry => entry.userId === user.id);

    const scrollToUserRow = () => {
        if (userEntry) {
            const isMobile = window.innerWidth < 768;
            const elementId = isMobile
                ? `highscore-card-${userEntry.id}`
                : `highscore-row-${userEntry.id}`;
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('ring-4', 'ring-blue-400');
                setTimeout(() => {
                    element.classList.remove('ring-4', 'ring-blue-400');
                }, 2000);
            }
        }
    };

    const timeframeLabels: Record<Timeframe, string> = {
        'all': 'All Time',
        'week': 'This Week',
        'month': 'This Month',
        'year': 'This Year'
    };

    return (
        <div className="container mx-auto px-3 py-5 md:px-4 md:py-8">
            {/* Rich Page Header */}
            <div className="page-header mb-5 md:mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                    <div className="flex-1">
                        <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider">Records</span>
                        <h1 className="page-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl flex items-center gap-2 md:gap-3 mt-1 mb-1 md:mb-2">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            <span>High Scores</span>
                        </h1>
                        <p className="page-subtitle text-sm md:text-base lg:text-lg text-gray-600">
                            The top single-game performances.
                        </p>
                    </div>

                    {/* User's Best Game Card */}
                    {userBestGame && userBestRank ? (
                        <button
                            onClick={scrollToUserRow}
                            className={`stat-card w-full md:w-auto md:min-w-[200px] cursor-pointer hover:shadow-md transition-all ${userBestRank <= 3 ? 'ring-2 ring-amber-400 md:animate-pulse-gold' : ''}`}
                            aria-label="Scroll to your best game on the list"
                        >
                            <div className="stat-label text-xs">Your Best Game</div>
                            <div className="flex items-center justify-center gap-2 mb-1 md:mb-2">
                                <span className="text-2xl md:text-3xl font-bold text-green-600">${userBestGame.score.toLocaleString()}</span>
                                {userBestRank === 1 && (
                                    <svg className="w-5 h-5 md:w-6 md:h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                )}
                            </div>
                            <div className="text-xs md:text-sm text-gray-600 flex justify-center gap-4 md:block md:space-y-1">
                                <div>Rank: <span className="font-semibold text-blue-600">#{userBestRank}</span></div>
                                <div>Accuracy: <span className="font-semibold text-gray-900">{userBestGame.accuracy}%</span></div>
                            </div>
                        </button>
                    ) : (
                        <div className="stat-card w-full md:w-auto md:min-w-[200px] bg-gray-50">
                            <div className="stat-label text-xs">Your Best Game</div>
                            <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">Complete a game to appear on the high scores!</p>
                            <Link href="/game" className="btn-primary btn-sm w-full">
                                Play Game
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
                {/* Timeframe Filter */}
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(timeframeLabels) as Timeframe[]).map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-full transition-colors ${
                                timeframe === tf
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {timeframeLabels[tf]}
                        </button>
                    ))}
                </div>

                {/* Link to Leaderboard */}
                <Link 
                    href="/leaderboard" 
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Overall Leaderboard
                </Link>
            </div>

            {/* Loading State */}
            {isLoading && timeframe !== 'all' && (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* Mobile Card List (visible < md) */}
            {!isLoading && (
                <ul className="md:hidden space-y-3" role="list" aria-label="High Scores">
                    {highScores.length === 0 ? (
                        <li className="card p-6 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 mb-1">No high scores yet</p>
                                    <p className="text-sm text-gray-600 mb-3">Be the first to set a high score!</p>
                                    <Link href="/game" className="btn-primary btn-sm inline-flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Play Game
                                    </Link>
                                </div>
                            </div>
                        </li>
                    ) : highScores.map((entry) => {
                        const isCurrentUser = entry.userId === user.id;
                        const isTopThree = entry.rank <= 3;

                        let cardBgClass = 'bg-white';
                        let rankTextClass = 'text-gray-700';
                        if (entry.rank === 1) {
                            cardBgClass = 'bg-amber-50 border-amber-200';
                            rankTextClass = 'text-amber-700';
                        } else if (entry.rank === 2) {
                            cardBgClass = 'bg-gray-100 border-gray-300';
                            rankTextClass = 'text-gray-600';
                        } else if (entry.rank === 3) {
                            cardBgClass = 'bg-orange-50 border-orange-200';
                            rankTextClass = 'text-orange-700';
                        }
                        if (isCurrentUser) {
                            cardBgClass = 'bg-blue-50 border-blue-400 ring-2 ring-blue-300';
                        }

                        return (
                            <li
                                key={entry.id}
                                id={`highscore-card-${entry.id}`}
                                className={`card ${cardBgClass} p-3 transition-colors`}
                            >
                                {/* Top row: rank + score */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                        {isTopThree && (
                                            <span className="text-base leading-none">
                                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                                            </span>
                                        )}
                                        <span className={`text-sm font-semibold ${rankTextClass}`}>#{entry.rank}</span>
                                    </div>
                                    <span className={`text-base font-bold ${entry.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ${entry.score.toLocaleString()}
                                    </span>
                                </div>

                                {/* Middle row: avatar + name */}
                                <div className="flex items-center gap-3 mb-2">
                                    <UserAvatar
                                        email=""
                                        displayName={entry.displayName}
                                        selectedIcon={entry.selectedIcon}
                                        avatarBackground={entry.avatarBackground}
                                        size="sm"
                                    />
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className={`truncate text-sm font-medium ${isCurrentUser ? 'text-blue-900 font-bold' : 'text-gray-900'}`}>
                                            {entry.displayName}
                                        </span>
                                        {isCurrentUser && (
                                            <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full">
                                                You
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom row: game details */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                                    <div>
                                        <span className="text-gray-500">Mode:</span>{' '}
                                        <span className="font-medium text-gray-800">{entry.gameMode}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Q&apos;s:</span>{' '}
                                        <span className="font-medium text-gray-800">{entry.questionsCorrect}/{entry.questionsTotal}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">{formatDate(entry.completedAt)}</span>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Desktop Table (visible >= md) */}
            {!isLoading && (
                <div className="hidden md:block card overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="inline-block min-w-full align-middle">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 border-b-2 border-gray-200">
                                    <tr>
                                        <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                            Rank
                                        </th>
                                        <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                            Player
                                        </th>
                                        <th scope="col" className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                            Score
                                        </th>
                                        <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                            Mode
                                        </th>
                                        <th scope="col" className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                            Questions
                                        </th>
                                        <th scope="col" className="px-4 lg:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                            Accuracy
                                        </th>
                                        <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                            Date
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {highScores.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 text-lg mb-1">No high scores yet</p>
                                                        <p className="text-gray-600 mb-4">Be the first to set a high score!</p>
                                                        <Link href="/game" className="btn-primary inline-flex items-center gap-2">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            Play Game
                                                        </Link>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : highScores.map((entry, index) => {
                                        const isCurrentUser = entry.userId === user.id;
                                        const isTopThree = entry.rank <= 3;
                                        
                                        let rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                                        let rankTextClass = 'text-gray-900';
                                        
                                        if (entry.rank === 1) {
                                            rowBgClass = 'bg-amber-50';
                                            rankTextClass = 'text-amber-700';
                                        } else if (entry.rank === 2) {
                                            rowBgClass = 'bg-gray-100';
                                            rankTextClass = 'text-gray-700';
                                        } else if (entry.rank === 3) {
                                            rowBgClass = 'bg-orange-50';
                                            rankTextClass = 'text-orange-700';
                                        }
                                        
                                        if (isCurrentUser) {
                                            rowBgClass = 'bg-blue-50 ring-2 ring-blue-400';
                                        }
                                        
                                        return (
                                            <tr 
                                                id={`highscore-row-${entry.id}`}
                                                key={entry.id} 
                                                className={`${rowBgClass} transition-colors hover:bg-blue-50/50`}
                                            >
                                                <td className="px-4 lg:px-6 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        {isTopThree && (
                                                            <span className="text-lg">
                                                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                                                            </span>
                                                        )}
                                                        <span className={`text-sm font-semibold ${rankTextClass}`}>
                                                            {entry.rank}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 lg:px-6 py-3 whitespace-nowrap">
                                                    <div className="flex items-center justify-start space-x-3">
                                                        <div className="flex-shrink-0">
                                                            <UserAvatar
                                                                email=""
                                                                displayName={entry.displayName}
                                                                selectedIcon={entry.selectedIcon}
                                                                avatarBackground={entry.avatarBackground}
                                                                size="md"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <div className={`text-sm font-medium truncate ${isCurrentUser ? 'text-blue-900 font-bold' : 'text-gray-900'}`}>
                                                                {entry.displayName}
                                                            </div>
                                                            {isCurrentUser && (
                                                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full flex-shrink-0">
                                                                    You
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={`px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm font-semibold ${entry.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    ${entry.score.toLocaleString()}
                                                </td>
                                                <td className="px-4 lg:px-6 py-3 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{entry.gameMode}</div>
                                                    <div className="flex gap-1 mt-0.5">
                                                        {entry.roundsPlayed.map(round => (
                                                            <span 
                                                                key={round}
                                                                className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                                                    round === 'Final' 
                                                                        ? 'bg-purple-100 text-purple-700' 
                                                                        : round === 'Double'
                                                                        ? 'bg-blue-100 text-blue-700'
                                                                        : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                            >
                                                                {round}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                                                    {entry.questionsCorrect}/{entry.questionsTotal}
                                                </td>
                                                <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                                                    {entry.accuracy}%
                                                </td>
                                                <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                                    {formatDate(entry.completedAt)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Back to Top Button */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-4 right-4 md:bottom-8 md:right-8 bg-amber-400 hover:bg-amber-500 text-blue-900 p-3 md:p-4 rounded-full shadow-2xl ring-2 md:ring-4 ring-white/50 transition-all duration-300 z-50 flex items-center justify-center hover:scale-110"
                    aria-label="Back to top"
                >
                    <svg 
                        className="w-5 h-5 md:w-6 md:h-6" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2.5} 
                            d="M5 10l7-7m0 0l7 7m-7-7v18" 
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}
