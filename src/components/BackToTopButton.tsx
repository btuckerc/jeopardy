'use client'

import { useEffect, useState } from 'react'

interface BackToTopButtonProps {
    threshold?: number
    ariaLabel?: string
}

export default function BackToTopButton({
    threshold = 400,
    ariaLabel = 'Back to top'
}: BackToTopButtonProps) {
    const [showBackToTop, setShowBackToTop] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > threshold)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [threshold])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    if (!showBackToTop) return null

    return (
        <button
            onClick={scrollToTop}
            className="fixed bottom-4 right-4 md:bottom-8 md:right-8 bg-amber-400 hover:bg-amber-500 text-blue-900 p-3 md:p-4 rounded-full shadow-2xl ring-2 md:ring-4 ring-white/50 transition-all duration-300 z-50 flex items-center justify-center hover:scale-110"
            aria-label={ariaLabel}
            type="button"
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
    )
}
