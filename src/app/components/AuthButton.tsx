'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import UserSettings from '@/components/UserSettings'
import AchievementsModal from '@/components/AchievementsModal'
import UserAvatar from '@/components/UserAvatar'
import { useClerk, SignInButton } from '@clerk/nextjs'
import type { AppUser } from '@/lib/clerk-auth'

interface AuthButtonProps {
    appUser: AppUser | null
}

export function AuthButton({ appUser }: AuthButtonProps) {
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [showAchievements, setShowAchievements] = useState(false)
    const [pendingDisputesCount, setPendingDisputesCount] = useState<number | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const { signOut } = useClerk()
    const router = useRouter()
    
    // Initialize from appUser - trust the server-rendered data
    // This prevents flash on refresh since we render immediately with server data
    const [displayName, setDisplayName] = useState<string | null>(
        appUser?.displayName ?? null
    )
    const [selectedIcon, setSelectedIcon] = useState<string | null>(
        appUser?.selectedIcon ?? null
    )
    const [avatarBackground, setAvatarBackground] = useState<string | null>(
        appUser?.avatarBackground ?? null
    )

    // Update state when appUser changes (e.g., after settings update)
    useEffect(() => {
        if (appUser) {
            setDisplayName(appUser.displayName ?? null)
            setSelectedIcon(appUser.selectedIcon ?? null)
            setAvatarBackground(appUser.avatarBackground ?? null)
        }
    }, [appUser])

    // Fetch pending dispute count for admins
    useEffect(() => {
        if (appUser?.role === 'ADMIN') {
            fetch('/api/admin/disputes/stats')
                .then(res => {
                    if (res.ok) {
                        return res.json()
                    }
                    return null
                })
                .then(data => {
                    if (data?.pendingCount !== undefined) {
                        setPendingDisputesCount(data.pendingCount)
                    }
                })
                .catch(error => {
                    console.error('Error fetching dispute stats:', error)
                    // Keep badge hidden on error
                    setPendingDisputesCount(null)
                })
        } else {
            // Reset count for non-admins
            setPendingDisputesCount(null)
        }
    }, [appUser])

    // Handle click outside to close menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setShowUserMenu(false)
            }
        }

        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside)
            // Prevent body scroll when menu is open on mobile
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.body.style.overflow = ''
        }
    }, [showUserMenu])

    // Handle ESC key to close menu
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && showUserMenu) {
                setShowUserMenu(false)
                buttonRef.current?.focus()
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [showUserMenu])

    // Handle keyboard navigation in menu
    useEffect(() => {
        if (!showUserMenu || !menuRef.current) return

        const menu = menuRef.current
        const menuItems = menu.querySelectorAll<HTMLElement>('[role="menuitem"]')
        if (menuItems.length === 0) return

        const handleKeyDown = (event: KeyboardEvent) => {
            const currentIndex = Array.from(menuItems).findIndex(item => item === document.activeElement)
            
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault()
                    const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0
                    menuItems[nextIndex]?.focus()
                    break
                case 'ArrowUp':
                    event.preventDefault()
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1
                    menuItems[prevIndex]?.focus()
                    break
                case 'Home':
                    event.preventDefault()
                    menuItems[0]?.focus()
                    break
                case 'End':
                    event.preventDefault()
                    menuItems[menuItems.length - 1]?.focus()
                    break
            }
        }

        menu.addEventListener('keydown', handleKeyDown)
        // Focus first item when menu opens
        menuItems[0]?.focus()

        return () => {
            menu.removeEventListener('keydown', handleKeyDown)
        }
    }, [showUserMenu])

    const handleSignOut = async () => {
        setShowUserMenu(false)
        await signOut()
        router.refresh()
    }

    // No appUser from server = show sign in button immediately (no flash)
    if (!appUser) {
        return (
            <SignInButton mode="modal">
                <button className="bg-amber-400 hover:bg-amber-500 text-gray-900 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 shadow-sm hover:shadow-md">
                    Sign in
                </button>
            </SignInButton>
        )
    }

    // Has appUser from server = show user button immediately (no flash)
    return (
        <>
            <div className="relative">
                <button
                    ref={buttonRef}
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                    aria-expanded={showUserMenu}
                    aria-haspopup="true"
                    aria-label={
                        appUser.role === 'ADMIN' && pendingDisputesCount !== null && pendingDisputesCount > 0
                            ? `User menu – ${pendingDisputesCount} pending dispute${pendingDisputesCount !== 1 ? 's' : ''}`
                            : 'User menu'
                    }
                >
                    <div className="relative">
                        <UserAvatar
                            email={appUser.email}
                            displayName={displayName}
                            selectedIcon={selectedIcon}
                            avatarBackground={avatarBackground}
                            size="sm"
                            interactive={true}
                        />
                        {appUser.role === 'ADMIN' && pendingDisputesCount !== null && pendingDisputesCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-[1.25rem] px-1.5 rounded-full bg-red-600 text-[0.7rem] font-bold flex items-center justify-center text-white shadow-md border-2 border-blue-700 z-10">
                                {pendingDisputesCount > 9 ? '9+' : pendingDisputesCount}
                            </span>
                        )}
                    </div>
                    <span className="hidden lg:inline-block max-w-[120px] truncate">{displayName || 'User'}</span>
                    <svg 
                        className={`w-4 h-4 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Profile Card Dropdown */}
                {showUserMenu && (
                    <>
                        {/* Backdrop for mobile */}
                        <div 
                            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
                            onClick={() => setShowUserMenu(false)}
                            aria-hidden="true"
                        />
                        
                        {/* Profile Card */}
                        <div
                            ref={menuRef}
                            className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-xl shadow-xl bg-white border border-gray-200 z-50 overflow-hidden animate-fade-in-slide-down"
                            role="menu"
                            aria-orientation="vertical"
                        >
                            {/* Profile Header */}
                            <div className="px-4 py-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <UserAvatar
                                        email={appUser.email}
                                        displayName={displayName}
                                        selectedIcon={selectedIcon}
                                        avatarBackground={avatarBackground}
                                        size="md"
                                        interactive={false}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-900 truncate">
                                            {displayName || 'User'}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate mt-0.5">
                                            {appUser.email}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Menu Actions */}
                            <div className="py-1 max-h-[min(80vh,24rem)] overflow-y-auto">
                                <button
                                    onClick={() => {
                                        setShowAchievements(true)
                                        setShowUserMenu(false)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 text-left"
                                    role="menuitem"
                                >
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                    <span>Achievements</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSettings(true)
                                        setShowUserMenu(false)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 text-left"
                                    role="menuitem"
                                >
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>Settings</span>
                                </button>
                                
                                {appUser.role === 'ADMIN' && (
                                    <Link
                                        href="/admin"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 text-left relative"
                                        role="menuitem"
                                    >
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        <span>Admin</span>
                                        {pendingDisputesCount !== null && pendingDisputesCount > 0 && (
                                            <span className="absolute right-3 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-[0.65rem] font-bold flex items-center justify-center text-white">
                                                {pendingDisputesCount > 9 ? '9+' : pendingDisputesCount}
                                            </span>
                                        )}
                                    </Link>
                                )}
                                
                                <div className="border-t border-gray-200 my-1" />
                                
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 text-left"
                                    role="menuitem"
                                >
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span>Sign out</span>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <UserSettings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onDisplayNameUpdate={(newDisplayName: string) => setDisplayName(newDisplayName)}
                onIconUpdate={(newIcon: string | null) => setSelectedIcon(newIcon)}
                onAvatarBackgroundUpdate={(newBackground: string | null) => setAvatarBackground(newBackground)}
                email={appUser.email}
                displayName={displayName}
                selectedIcon={selectedIcon}
                avatarBackground={avatarBackground}
            />
            <AchievementsModal
                isOpen={showAchievements}
                onClose={() => setShowAchievements(false)}
            />
        </>
    )
}
