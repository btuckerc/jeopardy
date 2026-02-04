'use client'

import { useState, useEffect, useCallback } from 'react'

const ONBOARDING_KEY = 'trivrdy-onboarding-completed'
const ONBOARDING_STEP_KEY = 'trivrdy-onboarding-step'
const ONBOARDING_USER_KEY = 'trivrdy-onboarding-user'

interface OnboardingState {
    isComplete: boolean
    currentStep: number
    showTour: boolean
}

export function useOnboarding(userId?: string | null) {
    const [state, setState] = useState<OnboardingState>({
        isComplete: true, // Default to complete to prevent flash
        currentStep: 0,
        showTour: false
    })
    
    useEffect(() => {
        // RESTART ON REFRESH: Always show tour on page load
        // To revert: Uncomment the persistence logic below and remove this block
        
        // Always show tour on mount (restart on refresh behavior)
        localStorage.removeItem(ONBOARDING_KEY)
        localStorage.setItem(ONBOARDING_STEP_KEY, '0')
        if (userId) {
            localStorage.setItem(ONBOARDING_USER_KEY, userId)
        }
        setState({
            isComplete: false,
            currentStep: 0,
            showTour: true
        })
        
        /* 
        // PERSISTENCE LOGIC (uncomment to restore):
        // Check if this is a different user than before
        const lastUserId = localStorage.getItem(ONBOARDING_USER_KEY)
        const isNewUser = userId && lastUserId !== userId
        
        // If new user, reset onboarding state
        if (isNewUser) {
            localStorage.removeItem(ONBOARDING_KEY)
            localStorage.setItem(ONBOARDING_USER_KEY, userId)
            setState({
                isComplete: false,
                currentStep: 0,
                showTour: true
            })
            return
        }
        
        // Check localStorage on mount
        const isComplete = localStorage.getItem(ONBOARDING_KEY) === 'true'
        const savedStep = parseInt(localStorage.getItem(ONBOARDING_STEP_KEY) || '0', 10)
        
        setState({
            isComplete,
            currentStep: savedStep,
            showTour: !isComplete
        })
        */
    }, [userId])
    
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
