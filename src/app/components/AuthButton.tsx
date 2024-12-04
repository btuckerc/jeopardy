'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import UserSettings from '@/components/UserSettings'
import UserAvatar from '@/components/UserAvatar'
import { useAuth } from '@/app/lib/auth'

export function AuthButton() {
    const { user, loading: authLoading, signIn, signOut } = useAuth()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [displayName, setDisplayName] = useState<string | null>(null)
    const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
    const [email, setEmail] = useState('')
    const [showEmailInput, setShowEmailInput] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [userDataLoading, setUserDataLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        const fetchUserData = async () => {
            if (user?.email) {
                setUserDataLoading(true)
                try {
                    const response = await fetch(`/api/user/display-name`)
                    if (response.ok) {
                        const data = await response.json()
                        setDisplayName(data.displayName)
                        setSelectedIcon(data.selectedIcon)
                    }
                } catch (err) {
                    console.error('Error fetching display name:', err)
                } finally {
                    setUserDataLoading(false)
                }
            } else {
                setDisplayName(null)
                setSelectedIcon(null)
                setUserDataLoading(false)
            }
        }
        fetchUserData()
    }, [user])

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        try {
            await signIn(email)
            setMessage('Check your email for the login link!')
        } catch (error: any) {
            setMessage(error?.message || 'An error occurred')
        }
    }

    const handleSignOut = async () => {
        await signOut()
        router.refresh()
        setShowUserMenu(false)
    }

    if (authLoading) {
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
                            disabled={authLoading}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                        >
                            {authLoading ? 'Sending...' : 'Send Magic Link'}
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

    if (userDataLoading) {
        return (
            <div className="flex items-center space-x-3 bg-blue-500 text-white px-4 py-2 rounded-md">
                <div className="animate-pulse flex items-center space-x-3">
                    <div className="w-6 h-6 bg-blue-400 rounded-full"></div>
                    <div className="h-4 w-20 bg-blue-400 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-3 bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-md text-sm font-medium h-10"
                >
                    <div className="flex items-center">
                        <UserAvatar
                            email={user.email ?? ''}
                            displayName={displayName}
                            selectedIcon={selectedIcon}
                            size="md"
                            className="cursor-pointer hover:opacity-80"
                        />
                        <span className="ml-3">{displayName || 'User'}</span>
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
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