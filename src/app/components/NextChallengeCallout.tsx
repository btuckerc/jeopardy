'use client'

import { useState, useEffect } from 'react'
import { getRefreshTimeDescription } from '@/lib/daily-challenge-utils'

interface NextChallengeCalloutProps {
    /** Server-computed timestamp for next challenge (9AM ET) */
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

// Format the UTC refresh time in user's local timezone
function formatLocalRefreshTime(utcTimeString: string): string {
    try {
        const utcDate = new Date(utcTimeString)
        const localHours = utcDate.getHours()
        const localMinutes = utcDate.getMinutes()
        
        const hour12 = localHours === 0 ? 12 : localHours > 12 ? localHours - 12 : localHours
        const ampm = localHours >= 12 ? 'PM' : 'AM'
        const minutesStr = localMinutes.toString().padStart(2, '0')
        
        return `${hour12}:${minutesStr} ${ampm}`
    } catch {
        return ''
    }
}

export default function NextChallengeCallout({ nextChallengeTime, compact = false }: NextChallengeCalloutProps) {
    // Calculate initial value synchronously to avoid hydration mismatch flicker
    // We use a stable initial value based on the server time prop
    const [timeRemaining, setTimeRemaining] = useState(() => calculateTimeRemaining(nextChallengeTime))
    const [mounted, setMounted] = useState(false)
    const [localRefreshTime, setLocalRefreshTime] = useState(() => formatLocalRefreshTime(nextChallengeTime))
    const [refreshTimeDescription, setRefreshTimeDescription] = useState(() => getRefreshTimeDescription())

    useEffect(() => {
        setMounted(true)
        
        // Update immediately on mount to sync with actual client time
        setTimeRemaining(calculateTimeRemaining(nextChallengeTime))
        setLocalRefreshTime(formatLocalRefreshTime(nextChallengeTime))
        setRefreshTimeDescription(getRefreshTimeDescription())
        
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
        <div className="relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-blue-900/60 border border-amber-500/30 p-4 sm:p-5 md:p-6 shadow-lg shadow-blue-900/20">
            {/* Subtle animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 via-transparent to-amber-400/10 animate-pulse" style={{ animationDuration: '3s' }} />
            
            <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-5 md:gap-6">
                <div className="text-center">
                    <p className="text-amber-300 font-bold text-base sm:text-lg md:text-xl mb-0.5 sm:mb-1">
                        Next Daily Challenge
                    </p>
                    <p className="text-blue-100/80 text-xs sm:text-sm md:text-base">
                        {mounted ? (
                            <>A new Final Jeopardy question at <span className="font-semibold text-amber-300">{refreshTimeDescription}</span></>
                        ) : (
                            <>A new Final Jeopardy question at {refreshTimeDescription}</>
                        )}
                    </p>
                </div>
                
                {/* Countdown Timer */}
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                    <TimeUnit value={hours} label="hrs" />
                    <span className="text-amber-400/50 text-lg sm:text-xl md:text-2xl font-light pb-3 sm:pb-4">:</span>
                    <TimeUnit value={minutes} label="min" />
                    <span className="text-amber-400/50 text-lg sm:text-xl md:text-2xl font-light pb-3 sm:pb-4">:</span>
                    <TimeUnit value={seconds} label="sec" />
                </div>
            </div>
        </div>
    )
}

function TimeUnit({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="w-12 sm:w-14 md:w-16 h-10 sm:h-12 md:h-14 bg-black/20 backdrop-blur-sm rounded-md sm:rounded-lg border border-amber-500/20 flex items-center justify-center shadow-inner">
                <span 
                    className="text-amber-400 font-bold text-lg sm:text-xl md:text-2xl tabular-nums tracking-tight"
                    suppressHydrationWarning
                >
                    {value.toString().padStart(2, '0')}
                </span>
            </div>
            <span className="text-blue-200/60 text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider mt-1 sm:mt-1.5 font-medium">
                {label}
            </span>
        </div>
    )
}
