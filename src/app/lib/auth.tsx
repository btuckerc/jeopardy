'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthContextType = {
    user: User | null
    loading: boolean
    signIn: (email: string) => Promise<void>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        // Check active sessions and sets the user
        const initializeAuth = async () => {
            try {
                console.log('Initializing auth...')
                const { data: { session } } = await supabase.auth.getSession()
                console.log('Got session:', session ? 'Yes' : 'No')
                if (mounted) {
                    setUser(session?.user ?? null)
                    setLoading(false)
                    console.log('Auth initialized. User:', session?.user ? 'Logged in' : 'Not logged in')
                }

                // Set up auth state change listener
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                    console.log('Auth state changed. Event:', _event)
                    if (mounted) {
                        setUser(session?.user ?? null)
                        console.log('Updated auth state. User:', session?.user ? 'Logged in' : 'Not logged in')
                    }
                })

                return () => {
                    mounted = false
                    subscription.unsubscribe()
                }
            } catch (error) {
                console.error('Error initializing auth:', error)
                if (mounted) {
                    setUser(null)
                    setLoading(false)
                }
            }
        }

        initializeAuth()
    }, [])

    const signIn = async (email: string) => {
        console.log('Attempting sign in for:', email)
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })
        if (error) {
            console.error('Sign in error:', error)
            throw error
        }
        console.log('Sign in email sent')
    }

    const signOut = async () => {
        console.log('Signing out...')
        const { error } = await supabase.auth.signOut()
        if (error) {
            console.error('Sign out error:', error)
            throw error
        }
        setUser(null)
        console.log('Signed out successfully')
    }

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
} 