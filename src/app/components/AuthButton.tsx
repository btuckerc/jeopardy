'use client'

import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { resetUserHistory } from '../actions/user'

export function AuthButton() {
    const { user, signIn, signOut } = useAuth()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setLoading(true)
            await signIn(email)
            setShowModal(false)
            alert('Check your email for the login link!')
        } catch (error) {
            alert('Error sending login link')
        } finally {
            setLoading(false)
        }
    }

    const handleResetHistory = async () => {
        if (!user) return

        if (window.confirm('Are you sure you want to reset your game history? This cannot be undone.')) {
            try {
                await resetUserHistory(user.id)
                alert('Game history has been reset successfully!')
            } catch (error) {
                alert('Error resetting game history')
            }
        }
        setShowDropdown(false)
    }

    if (user) {
        return (
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
        )
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium"
            >
                Sign In
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>
                        <form onSubmit={handleSignIn} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                            >
                                {loading ? 'Sending...' : 'Send Login Link'}
                            </button>
                            <p className="text-sm text-gray-600 mt-4">
                                We'll send you a magic link to sign in without a password.
                            </p>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
} 