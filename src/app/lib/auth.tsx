'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

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
    const supabase = createClientComponentClient()

    useEffect(() => {
        // Check active sessions and sets the user
        const initializeAuth = async () => {
            try {
                // Get session from Supabase
                const { data: { session } } = await supabase.auth.getSession()
                setUser(session?.user ?? null)
                setLoading(false)

                // Listen for auth changes
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                    console.log('Auth state changed:', event, session?.user?.email)

                    if (event === 'SIGNED_IN') {
                        setUser(session?.user ?? null)
                    } else if (event === 'SIGNED_OUT') {
                        setUser(null)
                    } else if (event === 'TOKEN_REFRESHED') {
                        setUser(session?.user ?? null)
                    }
                })

                return () => {
                    subscription.unsubscribe()
                }
            } catch (error) {
                console.error('Error initializing auth:', error)
                setUser(null)
                setLoading(false)
            }
        }

        initializeAuth()
    }, [supabase])

    const signIn = async (email: string) => {
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: process.env.NODE_ENV === 'production'
                        ? 'https://www.trivrdy.com/auth/callback'
                        : 'http://localhost:3000/auth/callback'
                }
            })
            if (error) throw error
        } catch (error) {
            console.error('Error signing in:', error)
            throw error
        }
    }

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            setUser(null)
            window.location.href = '/'
        } catch (error) {
            console.error('Error signing out:', error)
            throw error
        }
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