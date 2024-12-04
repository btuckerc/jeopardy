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
                const { data: { session } } = await supabase.auth.getSession()
                if (mounted) {
                    setUser(session?.user ?? null)
                    setLoading(false)
                }

                // Set up auth state change listener
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                    if (mounted) {
                        setUser(session?.user ?? null)
                    }
                })

                return () => {
                    mounted = false
                    subscription.unsubscribe()
                }
            } catch (error) {
                if (mounted) {
                    setUser(null)
                    setLoading(false)
                }
            }
        }

        initializeAuth()
    }, [])

    const signIn = async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })
        if (error) {
            throw error
        }
    }

    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
            throw error
        }
        setUser(null)
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