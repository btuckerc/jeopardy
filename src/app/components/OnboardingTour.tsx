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

// Mobile detection using viewport width
const isMobileDevice = () => {
    if (typeof window === 'undefined') return false
    // Check viewport width (mobile typically < 768px)
    const isMobileWidth = window.innerWidth < 768
    // Also check user agent as backup
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    return isMobileWidth || isMobileUA
}

export default function OnboardingTour({ userId }: OnboardingTourProps) {
    const { showTour, currentStep, nextStep, skipTour, completeTour } = useOnboarding(userId)
    const [actualStep, setActualStep] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    
    const tooltipRef = useRef<HTMLDivElement>(null)
    const targetRef = useRef<HTMLElement | null>(null)
    const rafId = useRef<number | null>(null)
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
    
    const TOOLTIP_WIDTH = 340
    const TOOLTIP_HEIGHT = 220
    const GAP = 16
    const VIEWPORT_MARGIN = 20
    
    // Check mobile on mount and resize
    useEffect(() => {
        const checkMobile = () => setIsMobile(isMobileDevice())
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])
    
    // Calculate safe tooltip position
    const calculatePosition = useCallback((targetRect: DOMRect, position: string) => {
        const vw = window.innerWidth
        const vh = window.innerHeight
        
        let x = 0
        let y = 0
        
        switch (position) {
            case 'bottom': {
                y = targetRect.bottom + GAP
                x = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2
                x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
                break
            }
            case 'top': {
                y = targetRect.top - GAP - TOOLTIP_HEIGHT
                x = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2
                x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
                break
            }
            case 'right': {
                x = targetRect.right + GAP
                y = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2
                y = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - TOOLTIP_HEIGHT - VIEWPORT_MARGIN))
                break
            }
            case 'left': {
                x = targetRect.left - GAP - TOOLTIP_WIDTH
                y = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2
                y = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - TOOLTIP_HEIGHT - VIEWPORT_MARGIN))
                break
            }
        }
        
        return { x, y }
    }, [])
    
    // Update tooltip position
    const updatePosition = useCallback(() => {
        const tooltip = tooltipRef.current
        const target = targetRef.current
        const step = tourSteps[actualStep]
        
        if (!tooltip) return
        
        // Banner step - fixed at bottom
        if (step.isBanner) {
            tooltip.style.position = 'fixed'
            tooltip.style.bottom = '0'
            tooltip.style.left = '0'
            tooltip.style.right = '0'
            tooltip.style.top = 'auto'
            tooltip.style.transform = 'none'
            tooltip.style.width = '100%'
            return
        }
        
        // Regular step with target
        if (!target) return
        
        const rect = target.getBoundingClientRect()
        const pos = calculatePosition(rect, step.position)
        
        tooltip.style.position = 'fixed'
        tooltip.style.bottom = 'auto'
        tooltip.style.left = '0'
        tooltip.style.right = 'auto'
        tooltip.style.width = `${TOOLTIP_WIDTH}px`
        tooltip.style.transform = `translate(${pos.x}px, ${pos.y}px)`
    }, [actualStep, calculatePosition])
    
    const scheduleUpdate = useCallback(() => {
        if (rafId.current) cancelAnimationFrame(rafId.current)
        rafId.current = requestAnimationFrame(updatePosition)
    }, [updatePosition])
    
    // Sync with onboarding hook
    useEffect(() => {
        setActualStep(currentStep)
    }, [currentStep])
    
    // Initialize step
    useEffect(() => {
        if (!showTour || isMobile || actualStep >= tourSteps.length) return
        
        const step = tourSteps[actualStep]
        
        // Banner step - no target needed
        if (step.isBanner) {
            targetRef.current = null
            scheduleUpdate()
            return
        }
        
        // Regular step - find target
        const element = document.getElementById(step.targetId!)
        if (element) {
            targetRef.current = element
            
            // Force immediate position update
            scheduleUpdate()
            
            // Check visibility after a small delay to ensure DOM is ready
            setTimeout(() => {
                const rect = element.getBoundingClientRect()
                const isVisible = rect.top >= 100 && rect.bottom <= window.innerHeight - 100
                
                if (!isVisible) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
                    scrollTimeout.current = setTimeout(scheduleUpdate, 600)
                }
            }, 50)
        }
        
        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current)
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
        }
    }, [showTour, isMobile, actualStep, scheduleUpdate])
    
    // Scroll/resize handlers
    useEffect(() => {
        if (!showTour || isMobile) return
        
        const handleScroll = () => scheduleUpdate()
        const handleResize = () => scheduleUpdate()
        
        window.addEventListener('scroll', handleScroll, { passive: true })
        window.addEventListener('resize', handleResize, { passive: true })
        
        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', handleResize)
        }
    }, [showTour, isMobile, scheduleUpdate])
    
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
    
    // Don't show on mobile
    if (!showTour || isMobile || actualStep >= tourSteps.length) return null
    
    const step = tourSteps[actualStep]
    const isLastStep = actualStep === tourSteps.length - 1
    const isFirstStep = actualStep === 0
    
    // Banner component (step 0)
    if (step.isBanner) {
        return (
            <div
                ref={tooltipRef}
                className="fixed bottom-0 left-0 right-0 z-50 bg-blue-900 border-t-4 border-amber-400 shadow-2xl"
            >
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1">
                                {step.title}
                            </h3>
                            <p className="text-blue-200 text-sm">
                                {step.description}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() => skipTour()}
                                className="text-blue-300 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={handleNext}
                                className="bg-amber-400 hover:bg-amber-500 text-blue-900 px-5 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap"
                            >
                                Take Tour →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    
    // Regular tour step with spotlight
    return (
        <>
            {/* Backdrop with transparent hole using mask */}
            <div 
                className="fixed inset-0 z-40 animate-fade-in pointer-events-none"
                style={{
                    background: 'rgba(0, 0, 0, 0.6)',
                }}
            />
            
            {/* Highlight ring - allows clicks to pass through to target */}
            {targetRef.current && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        top: 0,
                        left: 0,
                        transform: `translate(${(targetRef.current?.getBoundingClientRect().left || 0) - 8}px, ${(targetRef.current?.getBoundingClientRect().top || 0) - 8}px)`,
                        width: (targetRef.current?.getBoundingClientRect().width || 0) + 16,
                        height: (targetRef.current?.getBoundingClientRect().height || 0) + 16,
                    }}
                >
                    {/* Outer glow */}
                    <div 
                        className="absolute -inset-2 rounded-3xl animate-pulse"
                        style={{
                            boxShadow: '0 0 0 4px #fbbf24, 0 0 20px 8px rgba(251, 191, 36, 0.6)'
                        }}
                    />
                    {/* Inner transparent area */}
                    <div className="w-full h-full rounded-2xl bg-transparent" />
                </div>
            )}
            
            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className="fixed z-50"
                style={{ top: 0, left: 0, width: TOOLTIP_WIDTH }}
            >
                <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-6 animate-fade-in-up">
                    {/* X Close button */}
                    <button
                        onClick={() => skipTour()}
                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
                        aria-label="Close tour"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    
                    {/* Progress dots */}
                    <div className="flex items-center gap-1 mb-4">
                        {tourSteps.slice(1).map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                    i < actualStep ? 'bg-amber-400' : 'bg-gray-300'
                                }`}
                            />
                        ))}
                        <span className="text-xs text-gray-500 ml-2">
                            {actualStep} of {tourSteps.length - 1}
                        </span>
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 pr-6">
                        {step.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                        {step.description}
                    </p>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => skipTour()}
                            className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                        >
                            Skip Tour
                        </button>
                        <button
                            onClick={handleNext}
                            className="bg-amber-400 hover:bg-amber-500 text-blue-900 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors"
                        >
                            {isLastStep ? 'Finish' : 'Next →'}
                        </button>
                    </div>
                    
                    {/* Arrow - attached to tooltip edge */}
                    <div 
                        className="absolute w-3 h-3 bg-white"
                        style={{
                            // Position at tooltip edge
                            top: step.position === 'bottom' ? '-6px' : step.position === 'top' ? 'auto' : '50%',
                            bottom: step.position === 'top' ? '-6px' : 'auto',
                            left: step.position === 'right' ? '-6px' : step.position === 'left' ? 'auto' : 
                                  step.arrowPosition === 'left' ? '32px' : step.arrowPosition === 'right' ? 'auto' : '50%',
                            right: step.position === 'left' ? '-6px' : step.position === 'right' ? 'auto' :
                                   step.arrowPosition === 'right' ? '32px' : 'auto',
                            // Rotate to point right direction
                            transform: step.position === 'bottom' ? 'translateX(-50%) rotate(45deg)' :
                                      step.position === 'top' ? 'translateX(-50%) rotate(45deg)' :
                                      step.position === 'right' ? 'translateY(-50%) rotate(45deg)' :
                                      'translateY(-50%) rotate(45deg)',
                            // Show border on appropriate sides
                            borderTop: '1px solid #e5e7eb',
                            borderLeft: step.position === 'bottom' || step.position === 'right' ? '1px solid #e5e7eb' : 'none',
                            borderRight: step.position === 'top' || step.position === 'left' ? '1px solid #e5e7eb' : 'none',
                            borderBottom: 'none'
                        }}
                    />
                </div>
            </div>
        </>
    )
}
