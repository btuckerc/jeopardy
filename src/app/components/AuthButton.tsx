'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import SpoilerSettings from '@/components/SpoilerSettings'

export function AuthButton() {
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [email, setEmail] = useState('')
    const [showEmailInput, setShowEmailInput] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClientComponentClient()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${location.origin}/auth/callback`,
                }
            })

            if (error) throw error

            setMessage('Check your email for the login link!')
        } catch (error: any) {
            setMessage(error?.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.refresh()
        setShowUserMenu(false)
    }

    if (!user) {
        if (!showEmailInput) {
            return (
                <div className="relative">
                    <button
                        onClick={() => setShowEmailInput(true)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                        Sign in
                    </button>
                </div>
            )
        }

        return (
            <div className="relative inline-block">
                <form onSubmit={handleSignIn} className="absolute right-0 top-0 mt-2 bg-white p-4 rounded-lg shadow-lg w-64">
                    <input
                        type="email"
                        placeholder="Your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 border rounded mb-2"
                        required
                    />
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                        >
                            {loading ? 'Sending...' : 'Send Magic Link'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowEmailInput(false)}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                    {message && (
                        <p className={`mt-2 text-sm ${message.includes('error') ? 'text-red-600' : 'text-green-600'}`}>
                            {message}
                        </p>
                    )}
                </form>
            </div>
        )
    }

    return (
        <>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="relative flex rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                    <span className="absolute -inset-1.5" />
                    <span className="sr-only">Open user menu</span>
                    <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                    </div>
                </button>

                {showUserMenu && (
                    <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <button
                            onClick={() => {
                                setShowSettings(true)
                                setShowUserMenu(false)
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Settings
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Sign out
                        </button>
                    </div>
                )}
            </div>

            <SpoilerSettings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </>
    )
} 