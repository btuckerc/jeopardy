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
        position: 'right',
        arrowPosition: 'left'
    },
    {
        targetId: 'practice-card',
        title: 'Study Mode',
        description: 'Focus on specific categories or challenge yourself with triple stumpers.',
        position: 'left',
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
        
        const findTarget = () => {
            const element = document.getElementById(step.targetId!)
            if (element) {
                const rect = element.getBoundingClientRect()
                setTargetRect(rect)
                
                const isVisible = rect.top >= 50 && rect.bottom <= window.innerHeight - 50
                if (!isVisible) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }
        }
        
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
        const vh = window.innerHeight
        
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
            case 'right': {
                x = targetRect.right + GAP
                y = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2
                y = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - TOOLTIP_HEIGHT - VIEWPORT_MARGIN))
                tooltip.style.transform = `translate(${x}px, ${y}px)`
                break
            }
            case 'left': {
                x = targetRect.left - GAP - TOOLTIP_WIDTH
                y = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2
                y = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - TOOLTIP_HEIGHT - VIEWPORT_MARGIN))
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
    
    // Adjust footer padding
    useEffect(() => {
        if (typeof window === 'undefined') return
        
        const footer = document.querySelector('footer')
        if (!footer) return
        
        const step = tourSteps[actualStep]
        
        if (step?.isBanner) {
            footer.style.paddingBottom = '100px'
            footer.style.transition = 'padding-bottom 0.3s ease-out'
        } else {
            footer.style.paddingBottom = '24px'
        }
        
        return () => {
            footer.style.paddingBottom = ''
        }
    }, [actualStep])
    
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
    
    const highlightStyle = targetRect ? {
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
    } : null
    
    return (
        <>
            {/* Dark backdrop with clip-path for transparent hole */}
            {highlightStyle && (
                <div 
                    className="fixed inset-0 z-40 animate-fade-in pointer-events-auto"
                    style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        clipPath: `polygon(
                            0% 0%, 
                            100% 0%, 
                            100% 100%, 
                            0% 100%,
                            0% ${highlightStyle.top}px,
                            ${highlightStyle.left}px ${highlightStyle.top}px,
                            ${highlightStyle.left}px ${highlightStyle.top + highlightStyle.height}px,
                            ${highlightStyle.left + highlightStyle.width}px ${highlightStyle.top + highlightStyle.height}px,
                            ${highlightStyle.left + highlightStyle.width}px ${highlightStyle.top}px,
                            0% ${highlightStyle.top}px
                        )`
                    }}
                    onClick={() => skipTour()}
                />
            )}
            
            {/* Amber glow ring around target */}
            {highlightStyle && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        top: highlightStyle.top,
                        left: highlightStyle.left,
                        width: highlightStyle.width,
                        height: highlightStyle.height,
                        boxShadow: '0 0 0 4px #fbbf24, 0 0 20px 8px rgba(251, 191, 36, 0.6)',
                        borderRadius: '16px',
                    }}
                />
            )}
            
            {/* Transparent clickable area inside ring */}
            {highlightStyle && (
                <div
                    className="fixed z-50 pointer-events-auto cursor-pointer"
                    style={{
                        top: highlightStyle.top,
                        left: highlightStyle.left,
                        width: highlightStyle.width,
                        height: highlightStyle.height,
                        background: 'transparent',
                        borderRadius: '16px',
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        skipTour()
                    }}
                />
            )}
            
            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className="fixed z-50"
                style={{ 
                    top: 0, 
                    left: 0, 
                    width: TOOLTIP_WIDTH,
                    transform: targetRect ? undefined : 'translate(-9999px, -9999px)'
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
                    
                    {/* Arrow */}
                    <div 
                        className="absolute w-0 h-0"
                        style={{
                            // Position based on tooltip placement
                            top: step.position === 'bottom' ? '-8px' : step.position === 'top' ? 'auto' : '50%',
                            bottom: step.position === 'top' ? '-8px' : 'auto',
                            left: step.position === 'right' ? '-8px' : step.position === 'left' ? 'auto' : 
                                  step.arrowPosition === 'left' ? '40px' : step.arrowPosition === 'right' ? 'auto' : '50%',
                            right: step.position === 'left' ? '-8px' : step.position === 'right' ? 'auto' :
                                   step.arrowPosition === 'right' ? '40px' : 'auto',
                            transform: step.position === 'bottom' || step.position === 'top' 
                                ? (step.arrowPosition === 'center' || !step.arrowPosition ? 'translateX(-50%)' : 'none')
                                : 'translateY(-50%)',
                            // Triangle direction
                            borderLeft: step.position === 'right' ? 'none' : step.position === 'left' ? '8px solid white' : '8px solid transparent',
                            borderRight: step.position === 'left' ? 'none' : step.position === 'right' ? '8px solid white' : '8px solid transparent',
                            borderTop: step.position === 'bottom' ? 'none' : step.position === 'top' ? '8px solid white' : '8px solid transparent',
                            borderBottom: step.position === 'top' ? 'none' : step.position === 'bottom' ? '8px solid white' : '8px solid transparent',
                            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.1))'
                        }}
                    />
                </div>
            </div>
        </>
    )
}
