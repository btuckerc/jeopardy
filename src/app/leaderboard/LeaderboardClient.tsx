'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import type { AppUser } from '@/lib/clerk-auth';

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

interface LeaderboardClientProps {
    user: AppUser;
    initialLeaderboard: LeaderboardEntry[];
}

export default function LeaderboardClient({ user, initialLeaderboard }: LeaderboardClientProps) {
    const [leaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard);
    const [showBackToTop, setShowBackToTop] = useState(false);

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

    const scrollToUserRow = () => {
        if (currentUserEntry && currentUserRank) {
            const element = document.getElementById(`leaderboard-row-${currentUserEntry.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add a brief highlight effect
                element.classList.add('ring-4', 'ring-blue-400');
                setTimeout(() => {
                    element.classList.remove('ring-4', 'ring-blue-400');
                }, 2000);
            }
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Rich Page Header */}
            <div className="page-header mb-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Competition</span>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            <h1 className="page-title text-4xl md:text-5xl flex items-center gap-3">
                                <svg className="w-8 h-8 md:w-10 md:h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                                Global Leaderboard
                            </h1>
                        </div>
                        <p className="page-subtitle text-lg text-gray-600">
                            See how you rank against other players.
                        </p>
                    </div>

                    {/* Current User Summary Card */}
                    {currentUserEntry && currentUserRank ? (
                        <button
                            onClick={scrollToUserRow}
                            className={`stat-card min-w-[200px] cursor-pointer hover:shadow-md transition-all ${currentUserRank <= 3 ? 'ring-2 ring-amber-400 animate-pulse-gold' : ''}`}
                            aria-label="Scroll to your position on the leaderboard"
                        >
                            <div className="stat-label">Your Position</div>
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="text-3xl font-bold text-blue-600">#{currentUserRank}</span>
                                {currentUserRank === 1 && (
                                    <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                )}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                                <div>Points: <span className="font-semibold text-gray-900">${currentUserEntry.totalPoints.toLocaleString()}</span></div>
                                <div>Accuracy: <span className="font-semibold text-gray-900">
                                    {currentUserEntry.totalAnswered > 0 
                                        ? Math.round((currentUserEntry.correctAnswers / currentUserEntry.totalAnswered) * 100)
                                        : 0}%
                                </span></div>
                            </div>
                        </button>
                    ) : (
                        <div className="stat-card min-w-[200px] bg-gray-50">
                            <div className="stat-label">Your Position</div>
                            <p className="text-sm text-gray-600 mb-4">Start playing to appear on the leaderboard!</p>
                            <Link href="/game" className="btn-primary btn-sm w-full">
                                Play Game
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Leaderboard Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 border-b-2 border-gray-200">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                        Rank
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                        Player
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                        Total Points
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                        Questions Answered
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                        Avg Points/Correct
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {leaderboard.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-lg mb-1">No scores yet</p>
                                                    <p className="text-gray-600 mb-4">Start practicing to see your name on the leaderboard!</p>
                                                    <Link href="/practice" className="btn-primary inline-flex items-center gap-2">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                        </svg>
                                                        Start Practicing
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
                                            <td className="px-6 py-4 whitespace-nowrap">
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
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center justify-start space-x-4">
                                                    <div className="flex-shrink-0">
                                                        <UserAvatar
                                                            email=""
                                                            displayName={entry.displayName}
                                                            selectedIcon={entry.selectedIcon}
                                                            avatarBackground={entry.avatarBackground}
                                                            size="md"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-sm font-medium ${isCurrentUser ? 'text-blue-900 font-bold' : 'text-gray-900'}`}>
                                                            {entry.displayName}
                                                        </div>
                                                        {isCurrentUser && (
                                                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                                                                You
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                                                ${entry.totalPoints.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                                {entry.correctAnswers.toLocaleString()} / {entry.totalAnswered.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                                {entry.avgPointsPerCorrect.toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Back to Top Button */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 bg-amber-400 hover:bg-amber-500 text-blue-900 p-4 rounded-full shadow-2xl ring-4 ring-white/50 transition-all duration-300 z-50 flex items-center justify-center hover:scale-110"
                    aria-label="Back to top"
                >
                    <svg 
                        className="w-6 h-6" 
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

