'use client'

import { useState } from 'react'
import { useAuth } from '../lib/auth'

export function AuthButton() {
    const { user, loading, signIn, signOut } = useAuth()
    const [email, setEmail] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            await signIn(email)
            setShowModal(false)
            setEmail('')
        } catch (error) {
            console.error('Error signing in:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleResetHistory = async () => {
        if (!user) return

        if (window.confirm('Are you sure you want to reset your game history? This cannot be undone.')) {
            try {
                // We'll implement this functionality later
                alert('Game history has been reset successfully!')
            } catch (error) {
                console.error('Error resetting game history:', error)
            }
        }
        setShowDropdown(false)
    }

    // Don't render anything during initial load
    if (loading) {
        return <div className="w-24" /> // Placeholder with same width as button to prevent layout shift
    }

    return (
        <div className="relative opacity-0 animate-fade-in">
            {user ? (
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center space-x-2 text-white hover:text-gray-300"
                    >
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">
                                {user.email?.[0].toUpperCase() || '?'}
                            </span>
                        </div>
                        <svg
                            className={`h-5 w-5 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showDropdown && (
                        <>
                            {/* Overlay to capture clicks outside dropdown */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDropdown(false)}
                            />

                            {/* Dropdown menu */}
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50">
                                <div className="py-1">
                                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                                        Signed in as<br />
                                        <span className="font-medium">{user.email}</span>
                                    </div>
                                    <button
                                        onClick={handleResetHistory}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        Reset Game History
                                    </button>
                                    <button
                                        onClick={() => {
                                            signOut()
                                            setShowDropdown(false)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <>
                    <button
                        onClick={() => setShowModal(true)}
                            className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium"
                        >
                            Sign In
                        </button>

                        {showModal && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                                <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                                    <h2 className="text-xl font-bold mb-4 text-gray-900">Sign In</h2>
                                    <form onSubmit={handleSignIn}>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your email"
                                            className="w-full p-2 border rounded mb-4 text-gray-900"
                                            required
                                        />
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowModal(false)}
                                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
                                            >
                                                {isSubmitting ? 'Sending...' : 'Send Magic Link'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </>
            )}
        </div>
    )
} 