'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ArchiveDay {
    id: string
    date: string
    question: {
        id: string
        question: string
        answer: string
        category: string
        airDate: string | null
    }
    participation: {
        correct: boolean
        completedAt: string
        userAnswerText: string | null
    } | null
}

interface ArchiveCalendarProps {
    challenges: ArchiveDay[]
    activeDate: string
    onSelectDay: (day: ArchiveDay) => void
}

// Helper to format date for display
function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    })
}

// Helper to check if date is today
function isToday(dateStr: string, activeDateStr: string): boolean {
    const date = new Date(dateStr)
    const activeDate = new Date(activeDateStr)
    return date.toDateString() === activeDate.toDateString()
}

export default function ArchiveCalendar({ challenges, activeDate, onSelectDay }: ArchiveCalendarProps) {
    const [mounted, setMounted] = useState(false)
    
    useEffect(() => {
        setMounted(true)
    }, [])
    
    // Sort challenges by date (oldest first for calendar display)
    const sortedChallenges = [...challenges].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    const getDayStatus = (challenge: ArchiveDay) => {
        if (!challenge.participation) {
            return { status: 'unattempted', label: 'Not attempted' }
        }
        if (challenge.participation.correct) {
            return { status: 'correct', label: 'Correct' }
        }
        return { status: 'incorrect', label: 'Incorrect' }
    }
    
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'correct':
                return 'bg-green-500 border-green-400 text-white'
            case 'incorrect':
                return 'bg-red-500 border-red-400 text-white'
            default:
                return 'bg-gray-600 border-gray-500 text-gray-300'
        }
    }
    
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'correct':
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                )
            case 'incorrect':
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                )
            default:
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )
        }
    }
    
    if (!mounted) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[...Array(7)].map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-800 rounded-xl animate-pulse" />
                ))}
            </div>
        )
    }
    
    return (
        <div className="space-y-6">
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500" />
                    <span className="text-gray-300">Correct</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                    <span className="text-gray-300">Incorrect</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gray-600" />
                    <span className="text-gray-300">Not attempted</span>
                </div>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {sortedChallenges.map((challenge) => {
                    const { status, label } = getDayStatus(challenge)
                    const today = isToday(challenge.date, activeDate)
                    
                    return (
                        <button
                            key={challenge.id}
                            onClick={() => onSelectDay(challenge)}
                            className={`
                                relative aspect-square rounded-xl border-2 transition-all duration-200
                                hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400
                                ${getStatusColor(status)}
                                ${today ? 'ring-4 ring-amber-400 ring-opacity-50' : ''}
                            `}
                            aria-label={`${formatDate(challenge.date)} - ${label} - ${challenge.question.category}`}
                        >
                            {/* Today badge */}
                            {today && (
                                <div className="absolute -top-2 -right-2 bg-amber-400 text-blue-900 text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                    TODAY
                                </div>
                            )}
                            
                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                                <div className="mb-2">
                                    {getStatusIcon(status)}
                                </div>
                                <div className="text-xs font-medium text-center leading-tight">
                                    {mounted ? formatDate(challenge.date) : ''}
                                </div>
                                <div className="text-[10px] opacity-75 text-center mt-1 line-clamp-2">
                                    {challenge.question.category}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
            
            {/* Info text */}
            <p className="text-center text-gray-400 text-sm">
                Click any day to view the challenge. You can catch up on missed days within the last 7 days.
            </p>
            
            {/* Back to today's challenge - Prominent button style */}
            <div className="flex justify-center pt-4">
                <Link
                    href="/daily-challenge"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 text-blue-900 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Today's Challenge
                </Link>
            </div>
        </div>
    )
}
