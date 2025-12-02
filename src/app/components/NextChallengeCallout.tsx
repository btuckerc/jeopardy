'use client'

import { useState, useEffect } from 'react'

interface NextChallengeCalloutProps {
    /** Server-computed timestamp for next challenge (midnight UTC) */
    nextChallengeTime: string
    /** Whether to show in compact mode */
    compact?: boolean
}

function calculateTimeRemaining(targetTime: string): { hours: number; minutes: number; seconds: number; isReady: boolean } {
    const now = new Date().getTime()
    const target = new Date(targetTime).getTime()
    const diff = target - now
    
    // If time is negative or zero, the challenge is ready
    if (diff <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, isReady: true }
    }
    
    const totalSeconds = Math.floor(diff / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return { hours, minutes, seconds, isReady: false }
}

export default function NextChallengeCallout({ nextChallengeTime, compact = false }: NextChallengeCalloutProps) {
    // Calculate initial value synchronously to avoid hydration mismatch flicker
    // We use a stable initial value based on the server time prop
    const [timeRemaining, setTimeRemaining] = useState(() => calculateTimeRemaining(nextChallengeTime))
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        
        // Update immediately on mount to sync with actual client time
        setTimeRemaining(calculateTimeRemaining(nextChallengeTime))
        
        // Update every second for live countdown
        const interval = setInterval(() => {
            setTimeRemaining(calculateTimeRemaining(nextChallengeTime))
        }, 1000)

        return () => clearInterval(interval)
    }, [nextChallengeTime])

    const { hours, minutes, seconds, isReady } = timeRemaining

    // Show "ready" state when challenge is available (time expired or negative)
    if (isReady) {
        return (
            <div className={`flex items-center justify-center gap-2 ${
                compact 
                    ? 'px-4 py-2 bg-amber-400/20 rounded-lg border border-amber-400/30' 
                    : 'px-6 py-4 bg-gradient-to-r from-amber-400/20 via-amber-300/20 to-amber-400/20 rounded-xl border border-amber-400/30'
            }`}>
                <div className="relative">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    {mounted && (
                        <div className="absolute inset-0 animate-ping">
                            <svg className="w-5 h-5 text-amber-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </div>
                    )}
                </div>
                <span className={`font-medium text-sm ${compact ? 'text-amber-300' : 'text-amber-400'}`}>
                    New daily challenge is ready!
                </span>
            </div>
        )
    }

    if (compact) {
        return (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-white/70 text-sm">
                    Next challenge in{' '}
                    <span className="text-amber-400 font-semibold tabular-nums">
                        {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                    </span>
                </span>
            </div>
        )
    }

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-blue-900/40 border border-white/10 p-4 md:p-5">
            {/* Subtle animated gradient background - only animate after mount */}
            {mounted && (
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 via-transparent to-amber-400/5 animate-pulse" style={{ animationDuration: '3s' }} />
            )}
            
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-white/90 font-medium text-sm sm:text-base">
                            Next Daily Challenge
                        </p>
                        <p className="text-white/50 text-xs sm:text-sm">
                            A new Final Jeopardy question at midnight UTC
                        </p>
                    </div>
                </div>
                
                {/* Countdown Timer */}
                <div className="flex items-center gap-1 sm:gap-2">
                    <TimeUnit value={hours} label="hrs" />
                    <span className="text-white/30 text-lg font-light">:</span>
                    <TimeUnit value={minutes} label="min" />
                    <span className="text-white/30 text-lg font-light">:</span>
                    <TimeUnit value={seconds} label="sec" />
                </div>
            </div>
        </div>
    )
}

function TimeUnit({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="w-12 sm:w-14 h-10 sm:h-12 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 flex items-center justify-center">
                <span className="text-amber-400 font-bold text-lg sm:text-xl tabular-nums">
                    {value.toString().padStart(2, '0')}
                </span>
            </div>
            <span className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider mt-1">
                {label}
            </span>
        </div>
    )
}
