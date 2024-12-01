'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import UserSettings from '@/components/UserSettings'
import UserAvatar from '@/components/UserAvatar'
import { User as SupabaseUser } from '@supabase/supabase-js'

type User = {
    id: string;
    email: string;
}

export function AuthButton() {
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [user, setUser] = useState<User | null>(null)
    const [displayName, setDisplayName] = useState<string | null>(null)
    const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
    const [email, setEmail] = useState('')
    const [showEmailInput, setShowEmailInput] = useState(false)
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClientComponentClient()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user: supabaseUser } } = await supabase.auth.getUser()
            if (supabaseUser?.email) {
                setUser({
                    id: supabaseUser.id,
                    email: supabaseUser.email
                })
                // Fetch display name and icon
                try {
                    const response = await fetch(`/api/user/display-name`)
                    if (response.ok) {
                        const data = await response.json()
                        setDisplayName(data.displayName)
                        setSelectedIcon(data.selectedIcon)
                    }
                } catch (err) {
                    console.error('Error fetching display name:', err)
                }
            }
            setLoading(false)
        }
        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user?.email) {
                setUser({
                    id: session.user.id,
                    email: session.user.email
                })
                try {
                    const response = await fetch(`/api/user/display-name`)
                    if (response.ok) {
                        const data = await response.json()
                        setDisplayName(data.displayName)
                        setSelectedIcon(data.selectedIcon)
                    }
                } catch (err) {
                    console.error('Error fetching display name:', err)
                }
            } else {
                setUser(null)
                setDisplayName(null)
                setSelectedIcon(null)
            }
            setLoading(false)
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

    if (loading) {
        return <div className="w-[72px] h-[40px]" />
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
                        className="w-full px-3 py-2 border rounded mb-2 text-gray-900"
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
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                    <UserAvatar email={user.email} displayName={displayName} selectedIcon={selectedIcon} size="sm" />
                    <span>{displayName || 'User'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                        <div className="py-1">
                            <button
                                onClick={() => {
                                    setShowSettings(true)
                                    setShowUserMenu(false)
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Settings
                            </button>
                            <button
                                onClick={handleSignOut}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <UserSettings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onDisplayNameUpdate={(newDisplayName: string) => setDisplayName(newDisplayName)}
                onIconUpdate={(newIcon: string | null) => setSelectedIcon(newIcon)}
            />
        </>
    )
} 