'use client'

import { useEffect, useRef } from 'react'

interface TourTooltipProps {
    title: string
    description: string
    step: number
    totalSteps: number
    onNext: () => void
    onSkip: () => void
    position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function TourTooltip({
    title,
    description,
    step,
    totalSteps,
    onNext,
    onSkip,
    position = 'bottom'
}: TourTooltipProps) {
    const tooltipRef = useRef<HTMLDivElement>(null)
    
    useEffect(() => {
        // Handle click outside to close
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                // Optional: close on click outside
            }
        }
        
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    
    // Dynamic arrow positioning based on actual position
    const getArrowClasses = () => {
        switch (position) {
            case 'bottom':
                return '-top-1.5 left-1/2 -translate-x-1/2 border-t border-l'
            case 'top':
                return '-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r'
            case 'right':
                return '-left-1.5 top-1/2 -translate-y-1/2 border-t border-l'
            case 'left':
                return '-right-1.5 top-1/2 -translate-y-1/2 border-b border-r'
            default:
                return '-top-1.5 left-1/2 -translate-x-1/2 border-t border-l'
        }
    }
    
    return (
        <div
            ref={tooltipRef}
            className="relative z-50 w-full max-w-[340px] bg-white rounded-xl shadow-2xl border border-gray-200 p-6 animate-fade-in-up"
        >
            {/* Progress indicator */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${
                                i <= step ? 'bg-amber-400' : 'bg-gray-300'
                            }`}
                        />
                    ))}
                </div>
                <span className="text-sm text-gray-500">
                    Step {step + 1} of {totalSteps}
                </span>
            </div>
            
            {/* Content */}
            <h3 className="text-lg font-bold text-gray-900 mb-2">
                {title}
            </h3>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {description}
            </p>
            
            {/* Actions */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onSkip}
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                >
                    Skip Tour
                </button>
                <button
                    onClick={onNext}
                    className="bg-amber-400 hover:bg-amber-500 text-blue-900 px-5 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                    {step === totalSteps - 1 ? 'Finish' : 'Next Tip →'}
                </button>
            </div>
            
            {/* Arrow */}
            <div className={`absolute w-3 h-3 bg-white border-gray-200 transform rotate-45 ${getArrowClasses()}`} />
        </div>
    )
}
