'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/lib/auth'

interface GuestProgress {
    questionsAnswered: number
    lastActiveAt: string
}

export function useGuestProgress() {
    const { user } = useAuth()
    const [progress, setProgress] = useState<GuestProgress | null>(null)
    
    useEffect(() => {
        // Only track for guests
        if (user) {
            setProgress(null)
            return
        }
        
        // Load progress from localStorage
        const stored = localStorage.getItem('trivrdy_guest_progress')
        if (stored) {
            try {
                setProgress(JSON.parse(stored))
            } catch {
                setProgress(null)
            }
        }
    }, [user])
    
    const incrementProgress = () => {
        setProgress(prev => {
            const newProgress: GuestProgress = {
                questionsAnswered: (prev?.questionsAnswered || 0) + 1,
                lastActiveAt: new Date().toISOString()
            }
            localStorage.setItem('trivrdy_guest_progress', JSON.stringify(newProgress))
            return newProgress
        })
    }
    
    return { progress, incrementProgress }
}

export default function GuestProgressBanner() {
    const { user } = useAuth()
    const { progress } = useGuestProgress()
    const [dismissed, setDismissed] = useState(false)
    
    useEffect(() => {
        // Check if banner was dismissed
        const isDismissed = localStorage.getItem('trivrdy_guest_banner_dismissed') === 'true'
        setDismissed(isDismissed)
    }, [])
    
    const handleDismiss = () => {
        localStorage.setItem('trivrdy_guest_banner_dismissed', 'true')
        setDismissed(true)
    }
    
    // Don't show if user is logged in, no progress, or dismissed
    if (user || !progress || progress.questionsAnswered === 0 || dismissed) {
        return null
    }
    
    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-96 bg-blue-900 rounded-2xl shadow-2xl border border-blue-700/80 p-4 z-40 animate-fade-in-up">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-white font-semibold">
                                Question {progress.questionsAnswered} answered
                            </p>
                            <p className="text-blue-200 text-sm mt-0.5">
                                Progress saved • Sign in to keep it forever
                            </p>
                        </div>
                        
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
                            aria-label="Dismiss progress banner"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="mt-3 flex gap-2">
                        <Link
                            href="/sign-up"
                            className="flex-1 bg-amber-400 hover:bg-amber-500 text-blue-950 px-4 py-2.5 rounded-lg font-bold text-sm text-center transition-colors"
                        >
                            Sign Up
                        </Link>
                        <Link
                            href="/sign-in"
                            className="flex-1 bg-blue-800 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm text-center transition-colors"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
