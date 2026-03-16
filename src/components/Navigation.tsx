'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AuthButton } from '@/app/components/AuthButton'
import DownloadModal from './DownloadModal'
import type { AppUser } from '@/lib/clerk-auth'

interface NavigationProps {
    fredokaClassName: string
    appUser: AppUser | null
}

interface AcceptedChallengeItem {
    id: string
    status: string
    challengerUserId: string
    opponentUserId: string
    respondedAt: string | null
    challenger?: {
        displayName: string | null
    }
    opponent?: {
        displayName: string | null
    }
}

export function Navigation({ fredokaClassName, appUser }: NavigationProps) {
    const router = useRouter()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [showDownloadModal, setShowDownloadModal] = useState(false)
    const [showPracticeDropdown, setShowPracticeDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const mobileMenuRef = useRef<HTMLDivElement>(null)
    const practiceButtonRef = useRef<HTMLButtonElement>(null)
    const acceptedChallengeSeenRef = useRef<Set<string>>(new Set())
    const acceptedChallengeInitializedRef = useRef(false)

    useEffect(() => {
        acceptedChallengeSeenRef.current = new Set()
        acceptedChallengeInitializedRef.current = false

        if (!appUser?.id) {
            return
        }

        try {
            const raw = window.sessionStorage.getItem(`accepted-challenges-seen:${appUser.id}`)
            if (!raw) {
                return
            }
            const parsed = JSON.parse(raw) as string[]
            acceptedChallengeSeenRef.current = new Set(parsed.slice(-200))
        } catch {
            acceptedChallengeSeenRef.current = new Set()
        }
    }, [appUser?.id])

    useEffect(() => {
        if (!appUser?.id) {
            return
        }

        const persistSeen = () => {
            try {
                const seenKeys = Array.from(acceptedChallengeSeenRef.current).slice(-200)
                window.sessionStorage.setItem(`accepted-challenges-seen:${appUser.id}`, JSON.stringify(seenKeys))
            } catch {
                // best effort persistence
            }
        }

        const pollAcceptedChallenges = async () => {
            try {
                const response = await fetch('/api/challenges/friends?status=ACCEPTED&includeExpired=false&limit=50', {
                    cache: 'no-store',
                })
                if (!response.ok) {
                    return
                }

                const payload = await response.json() as { challenges?: AcceptedChallengeItem[] }
                const acceptedChallenges = (payload.challenges || []).filter((challenge) =>
                    challenge.status === 'ACCEPTED'
                    && challenge.challengerUserId === appUser.id
                    && Boolean(challenge.respondedAt),
                )

                if (!acceptedChallengeInitializedRef.current) {
                    acceptedChallenges.forEach((challenge) => {
                        acceptedChallengeSeenRef.current.add(`${challenge.id}:${challenge.respondedAt}`)
                    })
                    acceptedChallengeInitializedRef.current = true
                    persistSeen()
                    return
                }

                const newlyAccepted = acceptedChallenges.filter((challenge) => {
                    const seenKey = `${challenge.id}:${challenge.respondedAt}`
                    return !acceptedChallengeSeenRef.current.has(seenKey)
                })

                if (newlyAccepted.length === 0) {
                    return
                }

                newlyAccepted.forEach((challenge) => {
                    const seenKey = `${challenge.id}:${challenge.respondedAt}`
                    acceptedChallengeSeenRef.current.add(seenKey)

                    const accepterName = challenge.opponent?.displayName || 'Your friend'
                    toast.custom((t) => (
                        <div className="w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-blue-200 bg-white p-3 shadow-lg">
                            <p className="text-sm font-semibold text-gray-900">Challenge Accepted</p>
                            <p className="mt-1 text-xs text-gray-700">
                                {accepterName} accepted your challenge.
                            </p>
                            <div className="mt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    className="btn-outline btn-sm"
                                    onClick={() => toast.dismiss(t.id)}
                                >
                                    Dismiss
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary btn-sm"
                                    onClick={() => {
                                        toast.dismiss(t.id)
                                        router.push('/friends?tab=challenges')
                                    }}
                                >
                                    Open Challenges
                                </button>
                            </div>
                        </div>
                    ), { duration: 9000, position: 'bottom-right' })
                })

                persistSeen()
            } catch {
                // silent polling failure
            }
        }

        void pollAcceptedChallenges()
        const interval = window.setInterval(() => {
            void pollAcceptedChallenges()
        }, 15000)

        return () => {
            window.clearInterval(interval)
        }
    }, [appUser?.id, router])

    // Handle click outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowPracticeDropdown(false)
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setIsMobileMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowPracticeDropdown(false)
                setIsMobileMenuOpen(false)
                practiceButtonRef.current?.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Nav items configuration
    const navItems = [
        {
            href: '/game',
            label: 'Play Game',
            shortLabel: 'Play',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            href: '/daily-challenge',
            label: 'Daily Challenge',
            shortLabel: 'Daily',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            href: '/stats',
            label: 'Stats',
            shortLabel: 'Stats',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            )
        },
        {
            href: '/leaderboard',
            label: 'Leaderboard',
            shortLabel: 'Leaderboard',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            href: '/friends',
            label: 'Friends',
            shortLabel: 'Friends',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="8.5" cy="8.5" r="3.5" />
                    <circle cx="16.5" cy="9.5" r="2.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 20a6 6 0 0112 0" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 20a4 4 0 018 0" />
                </svg>
            )
        }
    ]

    const practiceItems = [
        { href: '/practice', text: 'All Study Modes' },
        { href: '/practice/category', text: 'By Category' },
        { href: '/practice/round/single', text: 'Single Jeopardy' },
        { href: '/practice/round/double', text: 'Double Jeopardy' },
        { href: '/practice/round/final', text: 'Final Jeopardy' },
        { href: '/practice/triple-stumpers', text: 'Triple Stumpers', className: 'text-amber-700 hover:bg-amber-50' }
    ]

    const primaryNavItems = [
        navItems[0],
        navItems[1],
        {
            href: '/practice',
            label: 'Study',
            shortLabel: 'Study',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            )
        }
    ]

    return (
        <nav className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center">
                    {/* Left side: Logo + Mobile button */}
                    <div className="flex items-center gap-3">
                        {/* Mobile/Tablet menu button - shows below xl */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="xl:hidden inline-flex items-center justify-center p-2 rounded-md text-white hover:text-blue-200 hover:bg-blue-700/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-900"
                            aria-expanded={isMobileMenuOpen}
                            aria-label="Open main menu"
                        >
                            <span className="sr-only">Open main menu</span>
                            {!isMobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </button>

                        {/* Logo */}
                        <Link href="/" className="flex items-center">
                            <span className={`${fredokaClassName} text-2xl text-white leading-none`}>
                                trivrdy
                            </span>
                        </Link>
                    </div>

                    {/* Core nav for intermediate widths (md-lg): keep primary actions visible */}
                    <div className="hidden md:flex xl:hidden items-center gap-1 ml-4">
                        {primaryNavItems.map((item) => (
                            <Link
                                key={`primary-${item.href}`}
                                href={item.href}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-semibold text-white hover:text-blue-200 hover:bg-blue-700/40 rounded-md transition-colors duration-200"
                            >
                                {item.icon}
                                <span>{item.shortLabel}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Nav items - left-aligned, hidden on tablet/mobile */}
                    <div className="hidden xl:flex items-center gap-1 ml-6">
                        {/* Play */}
                        <Link
                            href="/game"
                            className="flex items-center gap-2 px-3 py-1.5 text-base font-semibold text-white hover:text-blue-200 hover:bg-blue-700/40 rounded-md transition-colors duration-200"
                        >
                            {navItems[0].icon}
                            <span>{navItems[0].shortLabel}</span>
                        </Link>

                        {/* Daily */}
                        <Link
                            href="/daily-challenge"
                            className="flex items-center gap-2 px-3 py-1.5 text-base font-semibold text-white hover:text-blue-200 hover:bg-blue-700/40 rounded-md transition-colors duration-200"
                        >
                            {navItems[1].icon}
                            <span>{navItems[1].shortLabel}</span>
                        </Link>

                        {/* Study Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                ref={practiceButtonRef}
                                onClick={() => setShowPracticeDropdown(!showPracticeDropdown)}
                                className="flex items-center gap-2 px-3 py-1.5 text-base font-semibold text-white hover:text-blue-200 hover:bg-blue-700/40 rounded-md transition-colors duration-200"
                                aria-expanded={showPracticeDropdown}
                                aria-haspopup="true"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <span>Study</span>
                                <svg className={`w-4 h-4 transition-transform duration-200 ${showPracticeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showPracticeDropdown && (
                                <div className="absolute top-full left-0 pt-2 w-56 z-50">
                                    <div className="bg-white rounded-md shadow-xl border border-blue-200 py-1">
                                        {practiceItems.map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`block px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 ${item.className || ''}`}
                                                onClick={() => setShowPracticeDropdown(false)}
                                            >
                                                {item.text}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <Link
                            href="/stats"
                            className="flex items-center gap-2 px-3 py-1.5 text-base font-semibold text-white hover:text-blue-200 hover:bg-blue-700/40 rounded-md transition-colors duration-200"
                        >
                            {navItems[2].icon}
                            <span>{navItems[2].shortLabel}</span>
                        </Link>

                        {/* Leaderboard - hidden on small tablets */}
                        <Link
                            href="/leaderboard"
                            className="flex items-center gap-2 px-3 py-1.5 text-base font-semibold text-white hover:text-blue-200 hover:bg-blue-700/40 rounded-md transition-colors duration-200"
                        >
                            {navItems[3].icon}
                            <span>{navItems[3].shortLabel}</span>
                        </Link>

                        <Link
                            href="/friends"
                            className="flex items-center gap-2 px-3 py-1.5 text-base font-semibold text-white hover:text-blue-200 hover:bg-blue-700/40 rounded-md transition-colors duration-200"
                        >
                            {navItems[4].icon}
                            <span>{navItems[4].shortLabel}</span>
                        </Link>
                    </div>

                    {/* Spacer - pushes auth to the right */}
                    <div className="flex-1" />

                    {/* Right: Auth */}
                    <div className="flex-shrink-0">
                        <AuthButton appUser={appUser} />
                    </div>
                </div>
            </div>

                        {/* Mobile menu - shows below xl */}
            <div
                ref={mobileMenuRef}
                className={`${isMobileMenuOpen ? 'block' : 'hidden'} xl:hidden border-t border-blue-700`}
            >
                <div className="py-2 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700/50 transition-colors duration-200"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    ))}

                    {/* Study Links in Mobile */}
                    <div className="px-4 pt-2 pb-2">
                        <div className="text-blue-200 text-sm font-semibold mb-2">Study</div>
                        <div className="space-y-1">
                            {practiceItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`block px-4 py-2 text-sm text-white/90 hover:text-white hover:bg-blue-700/50 rounded ${item.className || ''}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {item.text}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Download Button */}
                    <div className="border-t border-blue-700 mt-2 pt-2">
                        <button
                            onClick={() => {
                                setShowDownloadModal(true)
                                setIsMobileMenuOpen(false)
                            }}
                            className="flex items-center gap-3 px-4 py-3 w-full text-base font-semibold text-white hover:bg-blue-700/50 transition-colors duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                            </svg>
                            Add to Home Screen
                        </button>
                    </div>
                </div>
            </div>

            <DownloadModal
                isOpen={showDownloadModal}
                onClose={() => setShowDownloadModal(false)}
            />
        </nav>
    )
}
