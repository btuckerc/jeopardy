'use client'

import { useState } from 'react'

interface ShareResultsProps {
    date: string
    category: string
    isCorrect: boolean
    streak: number
    timeToAnswer?: number
}

export default function ShareResults({ date, category, isCorrect, streak, timeToAnswer }: ShareResultsProps) {
    const [copied, setCopied] = useState(false)

    const generateShareText = () => {
        const dateObj = new Date(date)
        const dateStr = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
        
        const parts = [
            `trivrdy Daily Challenge - ${dateStr}`,
            '',
            `Category: ${category.toUpperCase()}`,
            `Result: ${isCorrect ? '🟩' : '🟥'} ${isCorrect ? 'Correct' : 'Incorrect'}${timeToAnswer ? ` in ${timeToAnswer}s` : ''}`,
        ]
        
        if (streak > 0) {
            parts.push(`Streak: ${streak} days`)
        }
        
        parts.push('', 'Play at trivrdy.com/daily-challenge')
        
        return parts.join('\n')
    }

    const handleShare = async () => {
        const shareText = generateShareText()
        
        try {
            if (navigator.share) {
                await navigator.share({
                    text: shareText
                })
            } else {
                await navigator.clipboard.writeText(shareText)
            }
        } catch (error) {
            console.error('Error sharing:', error)
        }
    }
    
    const handleCopy = async () => {
        const shareText = generateShareText()
        
        try {
            await navigator.clipboard.writeText(shareText)
            setCopied(true)
            // Reset after 2 seconds
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            console.error('Error copying:', error)
        }
    }
    
    return (
        <div className="flex justify-center gap-3">
            <button
                onClick={handleCopy}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    copied 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
            >
                {copied ? (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Results
                    </>
                )}
            </button>
            
            {typeof navigator !== 'undefined' && !!navigator.share && (
                <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-blue-900 rounded-lg font-bold transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                </button>
            )}
        </div>
    )
}
