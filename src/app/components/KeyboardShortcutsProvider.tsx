'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import KeyboardShortcuts from './KeyboardShortcuts'

export default function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts if user is typing in an input/textarea
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return
            }

            // Show help modal with ?
            if (e.key === '?') {
                e.preventDefault()
                setShowShortcuts(true)
                return
            }

            // Close help modal with Escape
            if (e.key === 'Escape' && showShortcuts) {
                setShowShortcuts(false)
                return
            }

            // Only trigger shortcuts if not in a modal/dialog (except our shortcuts modal)
            const hasOpenModal = document.querySelector('[role="dialog"]:not([data-shortcuts-modal])')
            if (hasOpenModal) return

            switch (e.key.toLowerCase()) {
                case 'g':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault()
                        router.push('/game')
                    }
                    break
                case 'd':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault()
                        router.push('/daily-challenge')
                    }
                    break
                case 's':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault()
                        router.push('/stats')
                    }
                    break
                case 'l':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault()
                        router.push('/leaderboard')
                    }
                    break
                case 'p':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault()
                        router.push('/practice')
                    }
                    break
                case 'h':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault()
                        router.push('/')
                    }
                    break
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [mounted, router, showShortcuts])

    return (
        <>
            {children}
            <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </>
    )
}
