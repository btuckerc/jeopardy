'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AuthButton } from '@/app/components/AuthButton'
import type { AppUser } from '@/lib/clerk-auth'

const DownloadModal = dynamic(() => import('./DownloadModal'), { ssr: false })

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
    const pathname = usePathname()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [showDownloadModal, setShowDownloadModal] = useState(false)
    const [showPracticeDropdown, setShowPracticeDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const mobileMenuRef = useRef<HTMLDivElement>(null)
    const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
    const practiceButtonRef = useRef<HTMLButtonElement>(null)
    const acceptedChallengeSeenRef = useRef<Set<string>>(new Set())
    const acceptedChallengeInitializedRef = useRef(false)

    const isRouteActive = (href: string) => {
        if (href === '/') return pathname === '/'
        return pathname === href || pathname.startsWith(`${href}/`)
    }

    const isPracticeActive = isRouteActive('/practice')

    // Close open menus on route navigation
    useEffect(() => {
        setShowPracticeDropdown(false)
        setIsMobileMenuOpen(false)
    }, [pathname])

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

        let lastPollAt = 0

        const persistSeen = () => {
            try {
                const seenKeys = Array.from(acceptedChallengeSeenRef.current).slice(-200)
                window.sessionStorage.setItem(`accepted-challenges-seen:${appUser.id}`, JSON.stringify(seenKeys))
            } catch {
                // best effort persistence
            }
        }

        const pollAcceptedChallenges = async () => {
            if (document.hidden) {
                return
            }
            const now = Date.now()
            if (now - lastPollAt < 10000) {
                return
            }
            lastPollAt = now

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
                        <div className="w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-blue-200 bg-white p-3.5 shadow-lg">
                            <p className="text-sm font-semibold text-slate-900">Challenge Accepted</p>
                            <p className="mt-1 text-xs text-slate-600">
                                {accepterName} accepted your challenge.
                            </p>
                            <div className="mt-2.5 flex justify-end gap-2">
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

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                void pollAcceptedChallenges()
            }
        }

        void pollAcceptedChallenges()
        const interval = window.setInterval(() => {
            void pollAcceptedChallenges()
        }, 45000)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            window.clearInterval(interval)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [appUser?.id, router])

    // Handle click outside to close dropdowns
    useEffect(() => {
        if (!showPracticeDropdown && !isMobileMenuOpen) return

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (showPracticeDropdown && dropdownRef.current && !dropdownRef.current.contains(target)) {
                setShowPracticeDropdown(false)
            }
            if (
                isMobileMenuOpen
                && mobileMenuRef.current
                && !mobileMenuRef.current.contains(target)
                && mobileMenuButtonRef.current
                && !mobileMenuButtonRef.current.contains(target)
            ) {
                setIsMobileMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showPracticeDropdown, isMobileMenuOpen])

    // Only intercept Escape and restore focus when a nav menu is actually open
    useEffect(() => {
        if (!showPracticeDropdown && !isMobileMenuOpen) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            if (showPracticeDropdown) {
                setShowPracticeDropdown(false)
                practiceButtonRef.current?.focus()
            } else if (isMobileMenuOpen) {
                setIsMobileMenuOpen(false)
                mobileMenuButtonRef.current?.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [showPracticeDropdown, isMobileMenuOpen])

    const navItems = [
        {
            href: '/game',
            label: 'Play Game',
            shortLabel: 'Play',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            href: '/stats',
            label: 'Stats',
            shortLabel: 'Stats',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            )
        },
        {
            href: '/leaderboard',
            label: 'Leaderboard',
            shortLabel: 'Leaderboard',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            href: '/friends',
            label: 'Friends',
            shortLabel: 'Friends',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
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
        { href: '/practice/triple-stumpers', text: 'Triple Stumpers', className: 'text-amber-700 hover:bg-amber-50 font-medium' }
    ]

    const primaryNavItems = [
        navItems[0],
        navItems[1],
        {
            href: '/practice',
            label: 'Study',
            shortLabel: 'Study',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            )
        }
    ]

    const getDesktopLinkClasses = (active: boolean) =>
        `flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-150 ${
            active
                ? 'bg-white/15 text-white ring-1 ring-white/25 shadow-sm'
                : 'text-blue-50 hover:text-white hover:bg-white/10'
        }`

    return (
        <nav aria-label="Main navigation" className="surface-immersive text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center">
                    {/* Left side: Logo + Mobile button */}
                    <div className="flex items-center gap-2.5">
                        <button
                            ref={mobileMenuButtonRef}
                            type="button"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="xl:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:text-blue-100 hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-900"
                            aria-expanded={isMobileMenuOpen}
                            aria-controls="mobile-nav-menu"
                            aria-label={isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
                        >
                            {!isMobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </button>

                        {/* Logo */}
                        <Link
                            href="/"
                            className="flex items-center rounded-md px-1 py-0.5 focus-visible:ring-offset-blue-900"
                            aria-current={pathname === '/' ? 'page' : undefined}
                        >
                            <span className={`${fredokaClassName} text-2xl font-medium text-white leading-none tracking-tight`}>
                                trivrdy
                            </span>
                        </Link>
                    </div>

                    {/* Core nav for intermediate widths (md-lg) */}
                    <div className="hidden md:flex xl:hidden items-center gap-1 ml-4">
                        {primaryNavItems.map((item) => {
                            const active = isRouteActive(item.href)
                            return (
                                <Link
                                    key={`primary-${item.href}`}
                                    href={item.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={getDesktopLinkClasses(active)}
                                >
                                    {item.icon}
                                    <span>{item.shortLabel}</span>
                                </Link>
                            )
                        })}
                    </div>

                    {/* Full desktop nav (xl+) */}
                    <div className="hidden xl:flex items-center gap-1 ml-6">
                        <Link
                            href="/game"
                            aria-current={isRouteActive('/game') ? 'page' : undefined}
                            className={getDesktopLinkClasses(isRouteActive('/game'))}
                        >
                            {navItems[0].icon}
                            <span>{navItems[0].shortLabel}</span>
                        </Link>

                        <Link
                            href="/daily-challenge"
                            aria-current={isRouteActive('/daily-challenge') ? 'page' : undefined}
                            className={getDesktopLinkClasses(isRouteActive('/daily-challenge'))}
                        >
                            {navItems[1].icon}
                            <span>{navItems[1].shortLabel}</span>
                        </Link>

                        {/* Study Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                ref={practiceButtonRef}
                                type="button"
                                onClick={() => setShowPracticeDropdown(!showPracticeDropdown)}
                                className={getDesktopLinkClasses(isPracticeActive || showPracticeDropdown)}
                                aria-expanded={showPracticeDropdown}
                                aria-haspopup="true"
                                aria-controls="study-nav-dropdown"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <span>Study</span>
                                <svg className={`w-4 h-4 transition-transform duration-150 ${showPracticeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showPracticeDropdown && (
                                <div id="study-nav-dropdown" className="absolute top-full left-0 pt-2 w-56 z-50">
                                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 overflow-hidden">
                                        {practiceItems.map((item) => {
                                            const active = pathname === item.href
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    aria-current={active ? 'page' : undefined}
                                                    className={`block px-4 py-2.5 text-sm transition-colors ${
                                                        active
                                                            ? 'bg-blue-50 text-blue-800 font-semibold'
                                                            : 'text-slate-700 hover:bg-slate-50'
                                                    } ${item.className || ''}`}
                                                    onClick={() => setShowPracticeDropdown(false)}
                                                >
                                                    {item.text}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <Link
                            href="/stats"
                            aria-current={isRouteActive('/stats') ? 'page' : undefined}
                            className={getDesktopLinkClasses(isRouteActive('/stats'))}
                        >
                            {navItems[2].icon}
                            <span>{navItems[2].shortLabel}</span>
                        </Link>

                        <Link
                            href="/leaderboard"
                            aria-current={isRouteActive('/leaderboard') ? 'page' : undefined}
                            className={getDesktopLinkClasses(isRouteActive('/leaderboard'))}
                        >
                            {navItems[3].icon}
                            <span>{navItems[3].shortLabel}</span>
                        </Link>

                        <Link
                            href="/friends"
                            aria-current={isRouteActive('/friends') ? 'page' : undefined}
                            className={getDesktopLinkClasses(isRouteActive('/friends'))}
                        >
                            {navItems[4].icon}
                            <span>{navItems[4].shortLabel}</span>
                        </Link>
                    </div>

                    <div className="flex-1" />

                    {/* Right: Auth */}
                    <div className="flex-shrink-0">
                        <AuthButton appUser={appUser} />
                    </div>
                </div>
            </div>

            {/* Mobile menu - shows below xl */}
            <div
                id="mobile-nav-menu"
                ref={mobileMenuRef}
                className={`${isMobileMenuOpen ? 'block' : 'hidden'} xl:hidden border-t border-white/15`}
            >
                <div className="py-2 space-y-1 px-2">
                    {navItems.map((item) => {
                        const active = isRouteActive(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={`flex items-center gap-3 px-3 py-3 text-base font-semibold rounded-lg transition-colors duration-150 ${
                                    active
                                        ? 'bg-white/15 text-white'
                                        : 'text-blue-50 hover:text-white hover:bg-white/10'
                                }`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        )
                    })}

                    {/* Study Links in Mobile */}
                    <div className="px-3 pt-3 pb-2">
                        <div className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2">Study</div>
                        <div className="space-y-1">
                            {practiceItems.map((item) => {
                                const active = pathname === item.href
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        aria-current={active ? 'page' : undefined}
                                        className={`block px-3 py-2.5 text-sm rounded-lg transition-colors ${
                                            active
                                                ? 'bg-white/15 text-white font-semibold'
                                                : 'text-white/90 hover:text-white hover:bg-white/10'
                                        }`}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        {item.text}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

                    {/* Download Button */}
                    <div className="border-t border-white/15 mt-2 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowDownloadModal(true)
                                setIsMobileMenuOpen(false)
                            }}
                            className="flex items-center gap-3 px-3 py-3 w-full text-base font-semibold text-blue-50 hover:text-white hover:bg-white/10 rounded-lg transition-colors duration-150"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                            </svg>
                            Add to Home Screen
                        </button>
                    </div>
                </div>
            </div>

            {showDownloadModal ? (
                <DownloadModal
                    isOpen={showDownloadModal}
                    onClose={() => setShowDownloadModal(false)}
                />
            ) : null}
        </nav>
    )
}
