'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthButton } from '@/app/components/AuthButton'

interface NavigationProps {
    fredokaClassName: string;
}

export function Navigation({ fredokaClassName }: NavigationProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    return (
        <nav className="bg-blue-800 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex items-center">
                        <Link href="/" className="flex-shrink-0 flex items-center">
                            <span className={`${fredokaClassName} text-2xl leading-none text-white`}>trivrdy</span>
                        </Link>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <Link href="/game" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                                Play Game
                            </Link>
                            <Link href="/practice" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                                Practice
                            </Link>
                            <Link href="/stats" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                                Statistics
                            </Link>
                            <Link href="/leaderboard" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                                Leaderboard
                            </Link>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <div className="sm:hidden mr-2">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-white hover:text-gray-300 focus:outline-none"
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
                        <AuthButton />
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} sm:hidden border-t border-blue-700`}>
                <div className="px-2 pt-2 pb-3 space-y-1">
                    <Link
                        href="/game"
                        className="text-white hover:bg-blue-700 block px-3 py-2 rounded-md text-base font-medium"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        Play Game
                    </Link>
                    <Link
                        href="/practice"
                        className="text-white hover:bg-blue-700 block px-3 py-2 rounded-md text-base font-medium"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        Practice
                    </Link>
                    <Link
                        href="/stats"
                        className="text-white hover:bg-blue-700 block px-3 py-2 rounded-md text-base font-medium"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        Statistics
                    </Link>
                    <Link
                        href="/leaderboard"
                        className="text-white hover:bg-blue-700 block px-3 py-2 rounded-md text-base font-medium"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        Leaderboard
                    </Link>
                </div>
            </div>
        </nav>
    )
} 