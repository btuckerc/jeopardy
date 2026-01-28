'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import ProfileCustomizationPrompt from '@/app/components/ProfileCustomizationPrompt';
import type { AppUser } from '@/lib/clerk-auth';

// Leaderboard types
type LeaderboardType = 'points' | 'weekly' | 'monthly' | 'streaks' | 'accuracy' | 'games';

interface BaseLeaderboardEntry {
    id: string;
    displayName: string;
    selectedIcon: string | null;
    avatarBackground: string | null;
}

interface PointsLeaderboardEntry extends BaseLeaderboardEntry {
    correctAnswers: number;
    totalAnswered: number;
    totalPoints: number;
    avgPointsPerCorrect: number;
}

interface StreaksLeaderboardEntry extends BaseLeaderboardEntry {
    currentStreak: number;
    longestStreak: number;
}

interface AccuracyLeaderboardEntry extends BaseLeaderboardEntry {
    correctAnswers: number;
    totalAnswered: number;
    accuracy: number;
}

interface GamesLeaderboardEntry extends BaseLeaderboardEntry {
    gamesCompleted: number;
    totalPoints: number;
}

type LeaderboardEntry = PointsLeaderboardEntry | StreaksLeaderboardEntry | AccuracyLeaderboardEntry | GamesLeaderboardEntry;

interface LeaderboardClientProps {
    user: AppUser;
    initialLeaderboard: PointsLeaderboardEntry[];
}

// Tab configuration
const leaderboardTabs: { type: LeaderboardType; label: string; shortLabel: string; icon: string; description: string }[] = [
    { type: 'points', label: 'All-Time Points', shortLabel: 'All-Time', icon: '🏆', description: 'Ranked by total points earned' },
    { type: 'weekly', label: 'This Week', shortLabel: 'Weekly', icon: '📅', description: 'Points earned in the last 7 days' },
    { type: 'monthly', label: 'This Month', shortLabel: 'Monthly', icon: '📆', description: 'Points earned in the last 30 days' },
    { type: 'streaks', label: 'Streaks', shortLabel: 'Streaks', icon: '🔥', description: 'Ranked by longest streak' },
    { type: 'accuracy', label: 'Accuracy', shortLabel: 'Accuracy', icon: '🎯', description: 'Ranked by answer accuracy (min. 50 questions)' },
    { type: 'games', label: 'Games Played', shortLabel: 'Games', icon: '🎮', description: 'Ranked by games completed' },
];

// Fetch function for React Query
async function fetchLeaderboard(type: LeaderboardType): Promise<LeaderboardEntry[]> {
    const response = await fetch(`/api/leaderboard?limit=100&type=${type}`);
    if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.leaderboard || []);
}

// Type guards
function isPointsEntry(entry: LeaderboardEntry, type: LeaderboardType): entry is PointsLeaderboardEntry {
    return type === 'points' || type === 'weekly' || type === 'monthly';
}

function isStreaksEntry(entry: LeaderboardEntry, type: LeaderboardType): entry is StreaksLeaderboardEntry {
    return type === 'streaks';
}

function isAccuracyEntry(entry: LeaderboardEntry, type: LeaderboardType): entry is AccuracyLeaderboardEntry {
    return type === 'accuracy';
}

function isGamesEntry(entry: LeaderboardEntry, type: LeaderboardType): entry is GamesLeaderboardEntry {
    return type === 'games';
}

export default function LeaderboardClient({ user, initialLeaderboard }: LeaderboardClientProps) {
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [achievementBadges, setAchievementBadges] = useState<Record<string, string[]>>({});
    const [previousRank, setPreviousRank] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<LeaderboardType>('points');
    const queryClient = useQueryClient();

    // Use React Query with stale-while-revalidate pattern
    const { data: leaderboard = initialLeaderboard, isLoading } = useQuery({
        queryKey: ['leaderboard', activeTab],
        queryFn: () => fetchLeaderboard(activeTab),
        initialData: activeTab === 'points' ? initialLeaderboard : undefined,
        staleTime: 30 * 1000, // Data is fresh for 30 seconds
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
    });

    // Listen for user profile updates
    useEffect(() => {
        const handleProfileUpdate = () => {
            queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
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

    // Compute current user's position
    const currentUserEntry = leaderboard.find(e => e.id === user.id);
    const currentUserRank = currentUserEntry ? leaderboard.findIndex(e => e.id === user.id) + 1 : null;

    // Load previous rank from localStorage (only for points leaderboard)
    useEffect(() => {
        if (activeTab !== 'points') return;
        
        const stored = localStorage.getItem('trivrdy_previousRank');
        if (stored && currentUserRank) {
            const prev = parseInt(stored, 10);
            if (!isNaN(prev) && prev !== currentUserRank) {
                setPreviousRank(prev);
                localStorage.setItem('trivrdy_previousRank', currentUserRank.toString());
            } else if (!stored || isNaN(prev)) {
                localStorage.setItem('trivrdy_previousRank', currentUserRank.toString());
            }
        } else if (currentUserRank) {
            localStorage.setItem('trivrdy_previousRank', currentUserRank.toString());
        }
    }, [currentUserRank, activeTab]);

    // Fetch achievement badges for leaderboard users
    useEffect(() => {
        if (leaderboard.length === 0) return;
        
        const userIds = leaderboard.slice(0, 50).map(e => e.id).join(',');
        fetch(`/api/leaderboard/achievements?userIds=${userIds}`)
            .then(res => res.json())
            .then(data => {
                setAchievementBadges(data);
            })
            .catch(() => {
                // Silently fail - achievements are optional
            });
    }, [leaderboard]);

    // Calculate distance to next rank for current user (points-based leaderboards)
    const distanceToNextRank = currentUserEntry && currentUserRank && currentUserRank > 1 && isPointsEntry(currentUserEntry, activeTab)
        ? (() => {
            const nextRankEntry = leaderboard[currentUserRank - 2];
            if (nextRankEntry && isPointsEntry(nextRankEntry, activeTab)) {
                return nextRankEntry.totalPoints - currentUserEntry.totalPoints;
            }
            return null;
        })()
        : null;

    // Calculate rank change
    const rankChange = previousRank && currentUserRank && activeTab === 'points'
        ? previousRank - currentUserRank
        : null;

    const scrollToUserRow = () => {
        if (currentUserEntry && currentUserRank) {
            const isMobile = window.innerWidth < 768;
            const elementId = isMobile
                ? `leaderboard-card-${currentUserEntry.id}`
                : `leaderboard-row-${currentUserEntry.id}`;
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

    // Get the current tab info
    const currentTabInfo = leaderboardTabs.find(t => t.type === activeTab)!;

    // Format value based on leaderboard type
    const formatPrimaryValue = (entry: LeaderboardEntry): string => {
        if (isPointsEntry(entry, activeTab)) {
            return `$${entry.totalPoints.toLocaleString()}`;
        }
        if (isStreaksEntry(entry, activeTab)) {
            return `${entry.longestStreak} days`;
        }
        if (isAccuracyEntry(entry, activeTab)) {
            return `${entry.accuracy.toFixed(1)}%`;
        }
        if (isGamesEntry(entry, activeTab)) {
            return `${entry.gamesCompleted} games`;
        }
        return '';
    };

    // Get secondary stats for display
    const getSecondaryStats = (entry: LeaderboardEntry): { label: string; value: string }[] => {
        if (isPointsEntry(entry, activeTab)) {
            return [
                { label: "Q's", value: `${entry.correctAnswers}/${entry.totalAnswered}` },
                { label: 'Avg', value: entry.avgPointsPerCorrect.toLocaleString() },
            ];
        }
        if (isStreaksEntry(entry, activeTab)) {
            return [
                { label: 'Current', value: `${entry.currentStreak} days` },
            ];
        }
        if (isAccuracyEntry(entry, activeTab)) {
            return [
                { label: "Q's", value: `${entry.correctAnswers}/${entry.totalAnswered}` },
            ];
        }
        if (isGamesEntry(entry, activeTab)) {
            return [
                { label: 'Points', value: `$${entry.totalPoints.toLocaleString()}` },
            ];
        }
        return [];
    };

    // Get column headers based on type
    const getTableHeaders = (): { label: string; align: 'left' | 'right' }[] => {
        const base = [
            { label: 'Rank', align: 'left' as const },
            { label: 'Player', align: 'left' as const },
        ];

        switch (activeTab) {
            case 'points':
            case 'weekly':
            case 'monthly':
                return [
                    ...base,
                    { label: 'Total Points', align: 'right' as const },
                    { label: 'Questions', align: 'right' as const },
                    { label: 'Avg Pts/Correct', align: 'right' as const },
                ];
            case 'streaks':
                return [
                    ...base,
                    { label: 'Longest Streak', align: 'right' as const },
                    { label: 'Current Streak', align: 'right' as const },
                ];
            case 'accuracy':
                return [
                    ...base,
                    { label: 'Accuracy', align: 'right' as const },
                    { label: 'Questions', align: 'right' as const },
                ];
            case 'games':
                return [
                    ...base,
                    { label: 'Games Completed', align: 'right' as const },
                    { label: 'Total Points', align: 'right' as const },
                ];
            default:
                return base;
        }
    };

    // Render table cells based on type
    const renderTableCells = (entry: LeaderboardEntry) => {
        if (isPointsEntry(entry, activeTab)) {
            return (
                <>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        ${entry.totalPoints.toLocaleString()}
                    </td>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                        {entry.correctAnswers.toLocaleString()} / {entry.totalAnswered.toLocaleString()}
                    </td>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                        {entry.avgPointsPerCorrect.toLocaleString()}
                    </td>
                </>
            );
        }
        if (isStreaksEntry(entry, activeTab)) {
            return (
                <>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        <span className="inline-flex items-center gap-1">
                            🔥 {entry.longestStreak} days
                        </span>
                    </td>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                        {entry.currentStreak > 0 ? (
                            <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                                🔥 {entry.currentStreak} days
                            </span>
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                    </td>
                </>
            );
        }
        if (isAccuracyEntry(entry, activeTab)) {
            return (
                <>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {entry.accuracy.toFixed(1)}%
                    </td>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                        {entry.correctAnswers.toLocaleString()} / {entry.totalAnswered.toLocaleString()}
                    </td>
                </>
            );
        }
        if (isGamesEntry(entry, activeTab)) {
            return (
                <>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {entry.gamesCompleted.toLocaleString()}
                    </td>
                    <td className="px-4 lg:px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                        ${entry.totalPoints.toLocaleString()}
                    </td>
                </>
            );
        }
        return null;
    };

    return (
        <div className="container mx-auto px-3 py-5 md:px-4 md:py-8">
            {/* Profile Customization Prompt - Show if user hasn't customized */}
            {user && (!user.displayName || !user.selectedIcon) && (
                <ProfileCustomizationPrompt trigger="leaderboard" />
            )}

            {/* Rich Page Header */}
            <div className="page-header mb-5 md:mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                    <div className="flex-1">
                        <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider">Competition</span>
                        <h1 className="page-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl flex items-center gap-2 md:gap-3 mt-1 mb-1 md:mb-2">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            <span>Global Leaderboard</span>
                        </h1>
                        <p className="page-subtitle text-sm md:text-base lg:text-lg text-gray-600">
                            {currentTabInfo.description}
                        </p>
                    </div>

                    {/* Current User Summary Card */}
                    {currentUserEntry && currentUserRank ? (
                        <button
                            onClick={scrollToUserRow}
                            className={`stat-card w-full md:w-auto md:min-w-[200px] cursor-pointer hover:shadow-md transition-all ${currentUserRank <= 3 ? 'ring-2 ring-amber-400 md:animate-pulse-gold' : ''}`}
                            aria-label="Scroll to your position on the leaderboard"
                        >
                            <div className="stat-label text-xs">Your Position</div>
                            <div className="flex items-center justify-center gap-2 mb-1 md:mb-2">
                                <span className="text-2xl md:text-3xl font-bold text-blue-600">#{currentUserRank}</span>
                                {currentUserRank === 1 && (
                                    <svg className="w-5 h-5 md:w-6 md:h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                )}
                            </div>
                            <div className="text-xs md:text-sm text-gray-600 flex justify-center gap-4 md:block md:space-y-1">
                                <div>{currentTabInfo.icon} <span className="font-semibold text-gray-900">{formatPrimaryValue(currentUserEntry)}</span></div>
                                {rankChange !== null && rankChange !== 0 && (
                                    <div className={`flex items-center gap-1 ${rankChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {rankChange > 0 ? (
                                            <>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7 7v-18" />
                                                </svg>
                                                <span>Moved up {rankChange} spot{rankChange !== 1 ? 's' : ''}</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                </svg>
                                                <span>Moved down {Math.abs(rankChange)} spot{Math.abs(rankChange) !== 1 ? 's' : ''}</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {distanceToNextRank !== null && distanceToNextRank > 0 && (
                                    <div className="text-xs text-gray-500">
                                        ${distanceToNextRank.toLocaleString()} away from #{currentUserRank! - 1}
                                    </div>
                                )}
                            </div>
                        </button>
                    ) : (
                        <div className="stat-card w-full md:w-auto md:min-w-[200px] bg-gray-50">
                            <div className="stat-label text-xs">Your Position</div>
                            <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">Start playing to appear on the leaderboard!</p>
                            <Link href="/game" className="btn-primary btn-sm w-full">
                                Play Game
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Leaderboard Type Tabs */}
            <div className="mb-4 md:mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex overflow-x-auto scrollbar-hide" aria-label="Leaderboard tabs">
                        {leaderboardTabs.map((tab) => (
                            <button
                                key={tab.type}
                                onClick={() => setActiveTab(tab.type)}
                                className={`whitespace-nowrap py-3 px-3 md:px-4 border-b-2 font-medium text-sm transition-colors flex items-center gap-1.5 ${
                                    activeTab === tab.type
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <span className="text-base">{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.shortLabel}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="card p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading leaderboard...</p>
                </div>
            )}

            {/* Mobile Card List (visible < md) */}
            {!isLoading && (
                <ul className="md:hidden space-y-3" role="list" aria-label="Leaderboard">
                    {leaderboard.length === 0 ? (
                        <li className="card p-6 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                                    <span className="text-2xl">{currentTabInfo.icon}</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 mb-1">No scores yet</p>
                                    <p className="text-sm text-gray-600 mb-3">Start practicing to see your name on the leaderboard!</p>
                                    <Link href="/practice" className="btn-primary btn-sm inline-flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        Start Studying
                                    </Link>
                                </div>
                            </div>
                        </li>
                    ) : leaderboard.map((entry, index) => {
                        const rank = index + 1;
                        const isCurrentUser = entry.id === user.id;
                        const isTopThree = rank <= 3;

                        // Determine card background for top three or current user
                        let cardBgClass = 'bg-white';
                        let rankTextClass = 'text-gray-700';
                        if (rank === 1) {
                            cardBgClass = 'bg-amber-50 border-amber-200';
                            rankTextClass = 'text-amber-700';
                        } else if (rank === 2) {
                            cardBgClass = 'bg-gray-100 border-gray-300';
                            rankTextClass = 'text-gray-600';
                        } else if (rank === 3) {
                            cardBgClass = 'bg-orange-50 border-orange-200';
                            rankTextClass = 'text-orange-700';
                        }
                        if (isCurrentUser) {
                            cardBgClass = 'bg-blue-50 border-blue-400 ring-2 ring-blue-300';
                        }

                        const secondaryStats = getSecondaryStats(entry);

                        return (
                            <li
                                key={entry.id}
                                id={`leaderboard-card-${entry.id}`}
                                className={`card ${cardBgClass} p-3 transition-colors`}
                            >
                                {/* Top row: rank + primary value */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                        {isTopThree && (
                                            <span className="text-base leading-none">
                                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                                            </span>
                                        )}
                                        <span className={`text-sm font-semibold ${rankTextClass}`}>#{rank}</span>
                                    </div>
                                    <span className="text-base font-bold text-gray-900">{formatPrimaryValue(entry)}</span>
                                </div>

                                {/* Middle row: avatar + name + achievements */}
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
                                        {achievementBadges[entry.id] && achievementBadges[entry.id].length > 0 && (
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {achievementBadges[entry.id].slice(0, 3).map((icon, idx) => (
                                                    <span key={idx} className="text-sm" title="Achievement badge">
                                                        {icon}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {isCurrentUser && (
                                            <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-semibold rounded-full">
                                                You
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom row: stats */}
                                {secondaryStats.length > 0 && (
                                    <div className="flex items-center gap-4 text-xs text-gray-600">
                                        {secondaryStats.map((stat, idx) => (
                                            <div key={idx}>
                                                <span className="text-gray-500">{stat.label}:</span>{' '}
                                                <span className="font-medium text-gray-800">{stat.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
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
                                        {getTableHeaders().map((header, idx) => (
                                            <th
                                                key={idx}
                                                scope="col"
                                                className={`px-4 lg:px-6 py-3 text-${header.align} text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap`}
                                            >
                                                {header.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {leaderboard.length === 0 ? (
                                        <tr>
                                            <td colSpan={getTableHeaders().length} className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                                        <span className="text-4xl">{currentTabInfo.icon}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 text-lg mb-1">No scores yet</p>
                                                        <p className="text-gray-600 mb-4">Start practicing to see your name on the leaderboard!</p>
                                                        <Link href="/practice" className="btn-primary inline-flex items-center gap-2">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                            </svg>
                                                            Start Studying
                                                        </Link>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : leaderboard.map((entry, index) => {
                                        const rank = index + 1;
                                        const isCurrentUser = entry.id === user.id;
                                        const isTopThree = rank <= 3;
                                        
                                        // Determine background and text colors for top three
                                        let rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                                        let rankTextClass = 'text-gray-900';
                                        
                                        if (rank === 1) {
                                            rowBgClass = 'bg-amber-50';
                                            rankTextClass = 'text-amber-700';
                                        } else if (rank === 2) {
                                            rowBgClass = 'bg-gray-100';
                                            rankTextClass = 'text-gray-700';
                                        } else if (rank === 3) {
                                            rowBgClass = 'bg-orange-50';
                                            rankTextClass = 'text-orange-700';
                                        }
                                        
                                        // Override with current user highlight
                                        if (isCurrentUser) {
                                            rowBgClass = 'bg-blue-50 ring-2 ring-blue-400';
                                        }
                                        
                                        return (
                                            <tr 
                                                id={`leaderboard-row-${entry.id}`}
                                                key={entry.id} 
                                                className={`${rowBgClass} transition-colors hover:bg-blue-50/50`}
                                            >
                                                <td className="px-4 lg:px-6 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        {isTopThree && (
                                                            <span className="text-lg">
                                                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                                                            </span>
                                                        )}
                                                        <span className={`text-sm font-semibold ${rankTextClass}`}>
                                                            {rank}
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
                                                            {achievementBadges[entry.id] && achievementBadges[entry.id].length > 0 && (
                                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                                    {achievementBadges[entry.id].slice(0, 3).map((icon, idx) => (
                                                                        <span key={idx} className="text-sm" title="Achievement badge">
                                                                            {icon}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {isCurrentUser && (
                                                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full flex-shrink-0">
                                                                    You
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                {renderTableCells(entry)}
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
