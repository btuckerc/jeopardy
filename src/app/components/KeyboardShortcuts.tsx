'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface KeyboardShortcutsProps {
    isOpen: boolean
    onClose: () => void
}

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!isOpen || !mounted) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts if user is typing in an input/textarea
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return
            }

            // Close help modal with Escape
            if (e.key === '?' || e.key === 'Escape') {
                if (isOpen) {
                    onClose()
                }
                return
            }

            // Only trigger shortcuts if not in a modal/dialog
            const hasOpenModal = document.querySelector('[role="dialog"]')
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
    }, [isOpen, mounted, router, onClose])

    if (!isOpen) return null

    const shortcuts = [
        { key: 'G', description: 'Go to Game Hub' },
        { key: 'D', description: 'Go to Daily Challenge' },
        { key: 'S', description: 'Go to Stats' },
        { key: 'L', description: 'Go to Leaderboard' },
        { key: 'P', description: 'Go to Practice' },
        { key: 'H', description: 'Go to Home' },
        { key: '?', description: 'Show/Hide Keyboard Shortcuts' },
        { key: 'Esc', description: 'Close modals/dialogs' },
    ]

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="shortcuts-title"
                    data-shortcuts-modal="true"
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h2 id="shortcuts-title" className="text-xl font-bold text-gray-900">
                            Keyboard Shortcuts
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Close shortcuts"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="px-6 py-6">
                        <div className="space-y-3">
                            {shortcuts.map((shortcut) => (
                                <div key={shortcut.key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                    <span className="text-sm text-gray-600">{shortcut.description}</span>
                                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">
                                        {shortcut.key}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                        <p className="mt-6 text-xs text-gray-500 text-center">
                            Shortcuts work when not typing in input fields
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
