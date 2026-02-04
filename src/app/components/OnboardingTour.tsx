'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useOnboarding } from '@/app/hooks/useOnboarding'

interface TourStep {
    targetId: string | null
    title: string
    description: string
    position: 'top' | 'bottom' | 'left' | 'right'
    arrowPosition?: 'left' | 'center' | 'right'
    isBanner?: boolean
}

const tourSteps: TourStep[] = [
    {
        targetId: null,
        title: 'Welcome to trivrdy! 🎉',
        description: 'New here? Take a quick tour to learn the ropes! Or explore on your own.',
        position: 'bottom',
        isBanner: true
    },
    {
        targetId: 'daily-challenge-card',
        title: 'Daily Challenge',
        description: 'Start each day with a fresh Final Jeopardy question and build your streak!',
        position: 'bottom',
        arrowPosition: 'center'
    },
    {
        targetId: 'play-game-card',
        title: 'Play Full Games',
        description: 'Play complete Jeopardy games with Single, Double, and Final rounds.',
        position: 'bottom',
        arrowPosition: 'left'
    },
    {
        targetId: 'practice-card',
        title: 'Study Mode',
        description: 'Focus on specific categories or challenge yourself with triple stumpers.',
        position: 'top',
        arrowPosition: 'right'
    }
]

interface OnboardingTourProps {
    userId?: string | null
}

const isMobileDevice = () => {
    if (typeof window === 'undefined') return false
    const isMobileWidth = window.innerWidth < 768
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    return isMobileWidth || isMobileUA
}

export default function OnboardingTour({ userId }: OnboardingTourProps) {
    const { showTour, currentStep, nextStep, skipTour, completeTour } = useOnboarding(userId)
    const [actualStep, setActualStep] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    
    const tooltipRef = useRef<HTMLDivElement>(null)
    const rafId = useRef<number | null>(null)
    
    const TOOLTIP_WIDTH = 340
    const TOOLTIP_HEIGHT = 220
    const GAP = 16
    const VIEWPORT_MARGIN = 20
    
    useEffect(() => {
        const checkMobile = () => setIsMobile(isMobileDevice())
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])
    
    useEffect(() => {
        setActualStep(currentStep)
    }, [currentStep])
    
    // Find and track target element
    useEffect(() => {
        if (!showTour || isMobile || actualStep >= tourSteps.length) return
        
        const step = tourSteps[actualStep]
        
        if (step.isBanner) {
            setTargetRect(null)
            return
        }
        
        // Find target element
        const findTarget = () => {
            const element = document.getElementById(step.targetId!)
            if (element) {
                const rect = element.getBoundingClientRect()
                setTargetRect(rect)
                
                // Check if visible
                const isVisible = rect.top >= 50 && rect.bottom <= window.innerHeight - 50
                if (!isVisible) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }
        }
        
        // Try immediately and after a delay
        findTarget()
        const timer = setTimeout(findTarget, 100)
        
        return () => clearTimeout(timer)
    }, [showTour, isMobile, actualStep])
    
    // Update tooltip position
    useEffect(() => {
        if (!showTour || isMobile || actualStep >= tourSteps.length) return
        
        const step = tourSteps[actualStep]
        const tooltip = tooltipRef.current
        
        if (!tooltip || step.isBanner || !targetRect) return
        
        const vw = window.innerWidth
        
        let x = 0
        let y = 0
        
        switch (step.position) {
            case 'bottom': {
                y = targetRect.bottom + GAP
                x = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2
                x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
                tooltip.style.transform = `translate(${x}px, ${y}px)`
                break
            }
            case 'top': {
                y = targetRect.top - GAP - TOOLTIP_HEIGHT
                x = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2
                x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
                tooltip.style.transform = `translate(${x}px, ${y}px)`
                break
            }
        }
    }, [showTour, isMobile, actualStep, targetRect])
    
    // Scroll handler
    useEffect(() => {
        if (!showTour || isMobile) return
        
        const handleScroll = () => {
            if (rafId.current) cancelAnimationFrame(rafId.current)
            rafId.current = requestAnimationFrame(() => {
                const step = tourSteps[actualStep]
                if (!step.isBanner && step.targetId) {
                    const element = document.getElementById(step.targetId)
                    if (element) {
                        setTargetRect(element.getBoundingClientRect())
                    }
                }
            })
        }
        
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [showTour, isMobile, actualStep])
    
    // Handle escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showTour && !isMobile) skipTour()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [showTour, isMobile, skipTour])
    
    const handleNext = () => {
        if (actualStep === tourSteps.length - 1) {
            completeTour()
        } else {
            nextStep()
        }
    }
    
    if (!showTour || isMobile || actualStep >= tourSteps.length) return null
    
    const step = tourSteps[actualStep]
    const isLastStep = actualStep === tourSteps.length - 1
    
    // Banner component
    if (step.isBanner) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-blue-900 border-t-4 border-amber-400 shadow-2xl">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
                            <p className="text-blue-200 text-sm">{step.description}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button onClick={() => skipTour()} className="text-blue-300 hover:text-white text-sm font-medium transition-colors whitespace-nowrap">
                                Dismiss
                            </button>
                            <button onClick={handleNext} className="bg-amber-400 hover:bg-amber-500 text-blue-900 px-5 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap">
                                Take Tour →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    
    // Calculate highlight position with padding
    const highlightStyle = targetRect ? {
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
    } : null
    
    return (
        <>
            {/* Dark backdrop */}
            <div className="fixed inset-0 z-40 bg-black/60 animate-fade-in pointer-events-none" />
            
            {/* Highlight ring */}
            {highlightStyle && (
                <>
                    {/* Glow effect */}
                    <div
                        className="fixed z-50 pointer-events-none"
                        style={{
                            ...highlightStyle,
                            boxShadow: '0 0 0 4px #fbbf24, 0 0 20px 8px rgba(251, 191, 36, 0.6)',
                            borderRadius: '16px',
                        }}
                    />
                    {/* Transparent inner area */}
                    <div
                        className="fixed z-50 pointer-events-auto cursor-pointer"
                        style={{
                            ...highlightStyle,
                            background: 'transparent',
                            borderRadius: '16px',
                        }}
                        onClick={() => skipTour()}
                    />
                </>
            )}
            
            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className="fixed z-50"
                style={{ 
                    top: 0, 
                    left: 0, 
                    width: TOOLTIP_WIDTH,
                    transform: targetRect ? undefined : 'translate(-9999px, -9999px)' // Hide if no target
                }}
            >
                <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-6 animate-fade-in-up">
                    {/* X Close button */}
                    <button
                        onClick={() => skipTour()}
                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    
                    {/* Progress */}
                    <div className="flex items-center gap-1 mb-4">
                        {tourSteps.slice(1).map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${i < actualStep ? 'bg-amber-400' : 'bg-gray-300'}`}
                            />
                        ))}
                        <span className="text-xs text-gray-500 ml-2">{actualStep} of {tourSteps.length - 1}</span>
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 pr-6">{step.title}</h3>
                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">{step.description}</p>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <button onClick={() => skipTour()} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                            Skip Tour
                        </button>
                        <button onClick={handleNext} className="bg-amber-400 hover:bg-amber-500 text-blue-900 px-5 py-2.5 rounded-lg font-bold text-sm">
                            {isLastStep ? 'Finish' : 'Next →'}
                        </button>
                    </div>
                    
                    {/* Arrow - attached to tooltip */}
                    <div 
                        className="absolute w-0 h-0"
                        style={{
                            top: step.position === 'bottom' ? '-8px' : step.position === 'top' ? 'auto' : '50%',
                            bottom: step.position === 'top' ? '-8px' : 'auto',
                            left: step.arrowPosition === 'left' ? '40px' : step.arrowPosition === 'right' ? 'auto' : '50%',
                            right: step.arrowPosition === 'right' ? '40px' : 'auto',
                            transform: step.arrowPosition === 'center' || !step.arrowPosition ? 'translateX(-50%)' : 'none',
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderBottom: step.position === 'bottom' ? '8px solid white' : 'none',
                            borderTop: step.position === 'top' ? '8px solid white' : 'none',
                            filter: 'drop-shadow(0 -1px 1px rgba(0,0,0,0.1))'
                        }}
                    />
                </div>
            </div>
        </>
    )
}
