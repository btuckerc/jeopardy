'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface QuickPlayButtonProps {
    user: { id: string } | null
}

export default function QuickPlayButton({ user }: QuickPlayButtonProps) {
    const router = useRouter()
    const [isStarting, setIsStarting] = useState(false)

    const handleQuickPlay = async () => {
        setIsStarting(true)
        try {
            if (user) {
                const response = await fetch('/api/games/quick-play', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })

                if (!response.ok) {
                    throw new Error('Failed to start game')
                }

                const game = await response.json()
                router.push(`/game/${game.id}`)
            } else {
                const response = await fetch('/api/games/guest-quick-play', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })

                if (!response.ok) {
                    throw new Error('Failed to start guest game')
                }

                const guestGame = await response.json()
                router.push(`/play/guest-game/${guestGame.guestGameId}`)
            }
        } catch (error) {
            console.error('Error starting game:', error)
            alert('Failed to start game. Please try again.')
        } finally {
            setIsStarting(false)
        }
    }

    return (
        <button
            onClick={handleQuickPlay}
            disabled={isStarting}
            className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-gray-400 text-blue-900 font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 text-lg"
        >
            {isStarting ? (
                <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Starting...
                </>
            ) : (
                <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Quick Play
                </>
            )}
        </button>
    )
}
