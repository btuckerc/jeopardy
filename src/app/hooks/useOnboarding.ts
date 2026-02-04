'use client'

import { useState, useEffect, useCallback } from 'react'

const ONBOARDING_KEY = 'trivrdy-onboarding-completed'
const ONBOARDING_STEP_KEY = 'trivrdy-onboarding-step'

interface OnboardingState {
    isComplete: boolean
    currentStep: number
    showTour: boolean
}

export function useOnboarding() {
    const [state, setState] = useState<OnboardingState>({
        isComplete: true, // Default to complete to prevent flash
        currentStep: 0,
        showTour: false
    })
    
    useEffect(() => {
        // Check localStorage on mount
        const isComplete = localStorage.getItem(ONBOARDING_KEY) === 'true'
        const savedStep = parseInt(localStorage.getItem(ONBOARDING_STEP_KEY) || '0', 10)
        
        setState({
            isComplete,
            currentStep: savedStep,
            showTour: !isComplete
        })
    }, [])
    
    const nextStep = useCallback(() => {
        setState(prev => {
            const newStep = prev.currentStep + 1
            localStorage.setItem(ONBOARDING_STEP_KEY, newStep.toString())
            return {
                ...prev,
                currentStep: newStep
            }
        })
    }, [])
    
    const skipTour = useCallback(() => {
        localStorage.setItem(ONBOARDING_KEY, 'true')
        localStorage.setItem(ONBOARDING_STEP_KEY, '0')
        setState(prev => ({
            ...prev,
            isComplete: true,
            showTour: false
        }))
    }, [])
    
    const completeTour = useCallback(() => {
        localStorage.setItem(ONBOARDING_KEY, 'true')
        localStorage.setItem(ONBOARDING_STEP_KEY, '0')
        setState(prev => ({
            ...prev,
            isComplete: true,
            showTour: false
        }))
    }, [])
    
    const restartTour = useCallback(() => {
        localStorage.removeItem(ONBOARDING_KEY)
        localStorage.setItem(ONBOARDING_STEP_KEY, '0')
        setState({
            isComplete: false,
            currentStep: 0,
            showTour: true
        })
    }, [])
    
    return {
        ...state,
        nextStep,
        skipTour,
        completeTour,
        restartTour
    }
}
