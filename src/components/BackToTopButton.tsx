'use client'

import { useEffect, useRef, useState } from 'react'

interface BackToTopButtonProps {
    threshold?: number
    ariaLabel?: string
}

export default function BackToTopButton({
    threshold = 400,
    ariaLabel = 'Back to top'
}: BackToTopButtonProps) {
    const [showBackToTop, setShowBackToTop] = useState(false)
    const visibleRef = useRef(false)

    useEffect(() => {
        const handleScroll = () => {
            const shouldShow = window.scrollY > threshold
            if (shouldShow !== visibleRef.current) {
                visibleRef.current = shouldShow
                setShowBackToTop(shouldShow)
            }
        }

        handleScroll()
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [threshold])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    if (!showBackToTop) return null

    return (
        <button
            onClick={scrollToTop}
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-12 w-12 bg-amber-400 hover:bg-amber-500 text-blue-950 rounded-full shadow-lg ring-2 ring-white/70 transition-all duration-150 z-40 flex items-center justify-center hover:scale-105"
            aria-label={ariaLabel}
            type="button"
        >
            <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
