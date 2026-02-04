'use client'

import { useState, useEffect, useCallback } from 'react'

const ONBOARDING_COMPLETED_KEY = 'trivrdy-onboarding-completed'
const ONBOARDING_IN_PROGRESS_KEY = 'trivrdy-onboarding-in-progress'
const ONBOARDING_USER_KEY = 'trivrdy-onboarding-user'

interface OnboardingState {
    isComplete: boolean
    currentStep: number
    showTour: boolean
}

export function useOnboarding(userId?: string | null) {
    const [state, setState] = useState<OnboardingState>({
        isComplete: true,
        currentStep: 0,
        showTour: false
    })
    
    useEffect(() => {
        const lastUserId = localStorage.getItem(ONBOARDING_USER_KEY)
        const isNewUser = userId && lastUserId !== userId
        const isCompleted = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true'
        const wasInProgress = localStorage.getItem(ONBOARDING_IN_PROGRESS_KEY) === 'true'
        
        if (isCompleted) {
            // Tour was completed, don't show
            setState({
                isComplete: true,
                currentStep: 0,
                showTour: false
            })
            return
        }
        
        if (isNewUser) {
            // New user - start fresh
            localStorage.setItem(ONBOARDING_USER_KEY, userId!)
            localStorage.removeItem(ONBOARDING_IN_PROGRESS_KEY)
            setState({
                isComplete: false,
                currentStep: 0,
                showTour: true
            })
            return
        }
        
        if (wasInProgress) {
            // User refreshed during tour - reset to banner
            localStorage.removeItem(ONBOARDING_IN_PROGRESS_KEY)
            setState({
                isComplete: false,
                currentStep: 0,
                showTour: true
            })
            return
        }
        
        // Default: show banner for existing users who haven't completed
        setState({
            isComplete: false,
            currentStep: 0,
            showTour: true
        })
    }, [userId])
    
    const nextStep = useCallback(() => {
        setState(prev => {
            const newStep = prev.currentStep + 1
            // Mark as in progress when moving from banner to first step
            if (prev.currentStep === 0) {
                localStorage.setItem(ONBOARDING_IN_PROGRESS_KEY, 'true')
            }
            return {
                ...prev,
                currentStep: newStep
            }
        })
    }, [])
    
    const skipTour = useCallback(() => {
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
        localStorage.removeItem(ONBOARDING_IN_PROGRESS_KEY)
        setState(prev => ({
            ...prev,
            isComplete: true,
            showTour: false
        }))
    }, [])
    
    const completeTour = useCallback(() => {
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
        localStorage.removeItem(ONBOARDING_IN_PROGRESS_KEY)
        setState(prev => ({
            ...prev,
            isComplete: true,
            showTour: false
        }))
    }, [])
    
    const restartTour = useCallback(() => {
        localStorage.removeItem(ONBOARDING_COMPLETED_KEY)
        localStorage.removeItem(ONBOARDING_IN_PROGRESS_KEY)
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
