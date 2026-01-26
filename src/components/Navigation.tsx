'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AuthButton } from '@/app/components/AuthButton'
import DownloadModal from './DownloadModal'
import type { AppUser } from '@/lib/clerk-auth'

interface NavigationProps {
    fredokaClassName: string
    appUser: AppUser | null
}

export function Navigation({ fredokaClassName, appUser }: NavigationProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [showDownloadModal, setShowDownloadModal] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [showPracticeDropdown, setShowPracticeDropdown] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 640)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    return (
        <nav className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex min-h-16 py-2 items-center justify-between">
                    {/* Left side: Logo and Navigation */}
                    <div className="flex items-center flex-1 min-w-0">
                        {/* Mobile menu button - visible on mobile and tablet (md to lg) */}
                        <div className="lg:hidden -ml-1 sm:-ml-3 mr-3">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-white hover:text-gray-300 hover:bg-blue-700 transition-colors duration-150 ease-in-out focus:outline-none"
                                aria-expanded="false"
                            >
                                <span className="sr-only">Open main menu</span>
                                {!isMobileMenuOpen ? (
                                    <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                ) : (
                                    <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Logo */}
                        <Link href="/" className="flex-shrink-0">
                            <div className="flex min-h-12 items-center">
                                <span className={`${fredokaClassName} text-2xl text-white leading-none`}>
                                    trivrdy
                                </span>
                            </div>
                        </Link>

                        {/* Desktop Navigation - Full (lg+) */}
                        <div className="hidden lg:ml-8 lg:flex lg:items-center lg:space-x-4">
                            <Link
                                href="/game"
                                className="flex items-center px-3 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Play Game
                            </Link>
                            <div 
                                className="relative z-40"
                                onMouseEnter={() => setShowPracticeDropdown(true)}
                                onMouseLeave={() => setShowPracticeDropdown(false)}
                            >
                            <Link
                                href="/practice"
                                className="flex items-center px-3 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                Study
                                <svg className="h-4 w-4 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </Link>
                                {showPracticeDropdown && (
                                    <div className="absolute top-full left-0 pt-2 w-56 z-40">
                                        <div className="bg-white rounded-md shadow-lg border border-gray-200 py-1">
                                            <Link
                                                href="/practice"
                                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={() => setShowPracticeDropdown(false)}
                                            >
                                                All Study Modes
                                            </Link>
                                            <Link
                                                href="/practice/category"
                                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={() => setShowPracticeDropdown(false)}
                                            >
                                                By Category
                                            </Link>
                                            <div className="border-t border-gray-200 my-1"></div>
                                            <Link
                                                href="/practice/round/single"
                                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={() => setShowPracticeDropdown(false)}
                                            >
                                                Single Jeopardy
                                            </Link>
                                            <Link
                                                href="/practice/round/double"
                                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={() => setShowPracticeDropdown(false)}
                                            >
                                                Double Jeopardy
                                            </Link>
                                            <Link
                                                href="/practice/round/final"
                                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={() => setShowPracticeDropdown(false)}
                                            >
                                                Final Jeopardy
                                            </Link>
                                            <div className="border-t border-gray-200 my-1"></div>
                                            <Link
                                                href="/practice/triple-stumpers"
                                                className="block px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50 font-medium"
                                                onClick={() => setShowPracticeDropdown(false)}
                                            >
                                                Triple Stumpers
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Link
                                href="/daily-challenge"
                                className="flex items-center px-3 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Daily Challenge
                            </Link>
                            <Link
                                href="/stats"
                                className="flex items-center px-3 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Stats
                            </Link>
                            <Link
                                href="/leaderboard"
                                className="flex items-center px-3 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Leaderboard
                            </Link>
                        </div>

                        {/* Intermediate Navigation - Priority items only (md to lg) */}
                        <div className="hidden md:flex md:items-center md:space-x-3 lg:hidden md:ml-4">
                            <Link
                                href="/game"
                                className="flex items-center px-2 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Play Game
                            </Link>
                            <Link
                                href="/practice"
                                className="flex items-center px-2 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                Study
                            </Link>
                            <Link
                                href="/daily-challenge"
                                className="flex items-center px-2 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Daily Challenge
                            </Link>
                            <Link
                                href="/stats"
                                className="flex items-center px-2 py-2 text-sm font-medium text-white hover:text-gray-300 transition-colors duration-150 ease-in-out whitespace-nowrap"
                            >
                                <svg className="h-5 w-5 mr-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Stats
                            </Link>
                        </div>
                    </div>

                    {/* Right side: Auth */}
                    <div className="flex items-center justify-end flex-shrink-0">
                        {/* Auth Button - pass appUser for immediate render */}
                        <AuthButton appUser={appUser} />
                    </div>
                </div>
            </div>

            {/* Mobile menu - visible on mobile and tablet (md to lg) */}
            <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} lg:hidden border-t border-blue-700`}>
                <div className="py-3 space-y-0.5">
                    <Link
                        href="/game"
                        className="text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800 block px-4 py-3 text-base font-medium transition-colors duration-150 ease-in-out"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div className="flex items-center">
                            <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Play Game
                        </div>
                    </Link>
                    <Link
                        href="/practice"
                        className="text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800 block px-4 py-3 text-base font-medium transition-colors duration-150 ease-in-out"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div className="flex items-center">
                            <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Study
                        </div>
                    </Link>
                    <Link
                        href="/daily-challenge"
                        className="text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800 block px-4 py-3 text-base font-medium transition-colors duration-150 ease-in-out"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div className="flex items-center">
                            <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Daily Challenge
                        </div>
                    </Link>
                    <Link
                        href="/stats"
                        className="text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800 block px-4 py-3 text-base font-medium transition-colors duration-150 ease-in-out"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div className="flex items-center">
                            <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Stats
                        </div>
                    </Link>
                    <Link
                        href="/leaderboard"
                        className="text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800 block px-4 py-3 text-base font-medium transition-colors duration-150 ease-in-out"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <div className="flex items-center">
                            <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Leaderboard
                        </div>
                    </Link>
                    {isMobile && (
                        <>
                            <div className="border-t border-blue-700 my-2" />
                            <button
                                onClick={() => {
                                    setShowDownloadModal(true)
                                    setIsMobileMenuOpen(false)
                                }}
                                className="text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800 block w-full text-left px-4 py-3 text-base font-medium transition-colors duration-150 ease-in-out"
                            >
                                <div className="flex items-center">
                                    <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                                    </svg>
                                    Add to Home Screen
                                </div>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <DownloadModal
                isOpen={showDownloadModal}
                onClose={() => setShowDownloadModal(false)}
            />
        </nav>
    )
}
