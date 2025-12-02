'use client';

import { useState, useEffect, useRef } from 'react';
import { format, subWeeks } from 'date-fns';
import { useRouter } from 'next/navigation';
import UserAvatar, { AVATAR_BACKGROUNDS, AvatarBackgroundKey } from './UserAvatar'
import { CATEGORIZED_EMOJIS, getEmojisByCategory, type EmojiCategory } from '@/lib/avatar'

interface SpoilerSettings {
    spoilerBlockDate: Date | null;
    spoilerBlockEnabled: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onDisplayNameUpdate: (newDisplayName: string) => void;
    onIconUpdate: (newIcon: string | null) => void;
    onAvatarBackgroundUpdate?: (newBackground: string | null) => void;
    email?: string;
    displayName?: string | null;
    selectedIcon?: string | null;
    avatarBackground?: string | null;
}

export default function UserSettings({ 
    isOpen, 
    onClose, 
    onDisplayNameUpdate, 
    onIconUpdate, 
    onAvatarBackgroundUpdate,
    email, 
    displayName, 
    selectedIcon,
    avatarBackground 
}: Props) {
    const [settings, setSettings] = useState<SpoilerSettings>({
        spoilerBlockDate: null,
        spoilerBlockEnabled: true
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>(email || '');
    const [localDisplayName, setLocalDisplayName] = useState(displayName || '');
    const [localSelectedIcon, setLocalSelectedIcon] = useState<string | null>(selectedIcon || null);
    const [localAvatarBackground, setLocalAvatarBackground] = useState<string | null>(avatarBackground || null);
    const [displayNameError, setDisplayNameError] = useState<string | null>(null);
    const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<EmojiCategory | 'all'>('all');
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const router = useRouter();

    // Handle ESC key to close modal
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            setTimeout(() => closeButtonRef.current?.focus(), 100);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Trap focus within modal
    useEffect(() => {
        if (!isOpen || !modalRef.current) return;

        const modal = modalRef.current;
        const focusableElements = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;

            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement?.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        modal.addEventListener('keydown', handleTab);
        return () => {
            modal.removeEventListener('keydown', handleTab);
        };
    }, [isOpen]);

    // Sync props to local state when they change
    useEffect(() => {
        if (email) setUserEmail(email);
        if (displayName !== undefined) setLocalDisplayName(displayName || '');
        if (selectedIcon !== undefined) setLocalSelectedIcon(selectedIcon || null);
        if (avatarBackground !== undefined) setLocalAvatarBackground(avatarBackground || null);
    }, [email, displayName, selectedIcon, avatarBackground]);

    useEffect(() => {
        const fetchUserData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch display name, icon, and avatar background
                const displayNameResponse = await fetch(`/api/user/display-name`);
                if (displayNameResponse.ok) {
                    const data = await displayNameResponse.json();
                    setLocalDisplayName(data.displayName || '');
                    setLocalSelectedIcon(data.selectedIcon || null);
                    setLocalAvatarBackground(data.avatarBackground || null);
                }

                // Fetch spoiler settings
                const response = await fetch(`/api/user/spoiler-settings`);
                if (!response.ok) {
                    throw new Error('Failed to fetch settings');
                }
                const data = await response.json();

                setSettings({
                    spoilerBlockDate: data.spoilerBlockDate ? new Date(data.spoilerBlockDate) : null,
                    spoilerBlockEnabled: data.spoilerBlockEnabled
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            fetchUserData();
        }
    }, [isOpen]);

    const updateSettings = async (newSettings: Partial<SpoilerSettings>) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/user/spoiler-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newSettings,
                    lastSpoilerPrompt: new Date()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update settings');
            }

            setSettings(prev => ({ ...prev, ...newSettings }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetData = async () => {
        if (!confirm('Are you sure you want to reset all your games and statistics? This action cannot be undone.')) {
            return;
        }

        setIsResetting(true);
        try {
            const response = await fetch('/api/user/reset', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to reset data');
            }

            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('questionStates_') || key === 'gameState') {
                    localStorage.removeItem(key);
                }
            });

            onClose();
            router.refresh();
            alert('Your data has been reset successfully.');
        } catch (error) {
            console.error('Error resetting data:', error);
            alert('Failed to reset data. Please try again.');
        } finally {
            setIsResetting(false);
        }
    };

    const handleUpdateDisplayName = async () => {
        setDisplayNameError(null)
        setIsUpdatingDisplayName(true)

        try {
            const response = await fetch('/api/user/display-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: localDisplayName })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update display name')
            }

            const data = await response.json()
            setLocalDisplayName(data.displayName)
            onDisplayNameUpdate(data.displayName)
            
            // Notify other components (like leaderboard) that profile was updated
            window.dispatchEvent(new CustomEvent('user-profile-updated'))
            
            // Refresh the page data to update server-rendered content
            router.refresh()
        } catch (err) {
            setDisplayNameError(err instanceof Error ? err.message : 'Failed to update display name')
        } finally {
            setIsUpdatingDisplayName(false)
        }
    }

    const handleUpdateIcon = async (icon: string | null) => {
        setLocalSelectedIcon(icon);
        try {
            const response = await fetch('/api/user/update-icon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icon })
            });

            if (!response.ok) {
                throw new Error('Failed to update icon');
            }

            const data = await response.json();
            onIconUpdate(data.selectedIcon);
            
            // Notify other components (like leaderboard) that profile was updated
            window.dispatchEvent(new CustomEvent('user-profile-updated'));
            
            // Refresh the page data to update server-rendered content
            router.refresh();
        } catch (err) {
            console.error('Error updating icon:', err);
        }
    };

    const handleUpdateAvatarBackground = async (background: string | null) => {
        setLocalAvatarBackground(background);
        try {
            const response = await fetch('/api/user/update-icon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatarBackground: background })
            });

            if (!response.ok) {
                throw new Error('Failed to update avatar background');
            }

            const data = await response.json();
            if (onAvatarBackgroundUpdate) {
                onAvatarBackgroundUpdate(data.avatarBackground);
            }
            
            // Notify other components (like leaderboard) that profile was updated
            window.dispatchEvent(new CustomEvent('user-profile-updated'));
            
            // Refresh the page data to update server-rendered content
            router.refresh();
        } catch (err) {
            console.error('Error updating avatar background:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto overflow-x-hidden p-4 sm:p-6 animate-fade-in" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
        >
            <div 
                ref={modalRef}
                className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8 animate-fade-in-slide-down overflow-x-hidden" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 rounded-t-2xl z-10">
                    <div className="flex justify-between items-center">
                        <h2 id="settings-title" className="text-xl font-semibold text-gray-900">Settings</h2>
                        <button 
                            ref={closeButtonRef}
                            onClick={onClose} 
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Close settings"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-5 py-5 overflow-x-hidden">
                    {error && (
                        <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="spinner text-blue-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto overflow-x-hidden">
                            {/* Avatar & Icon Section */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 border border-gray-200">
                                <div className="flex items-start gap-4 mb-4">
                                    <UserAvatar
                                        email={userEmail}
                                        displayName={localDisplayName}
                                        selectedIcon={localSelectedIcon}
                                        avatarBackground={localAvatarBackground}
                                        size="lg"
                                        interactive={false}
                                    />
                                    <div className="flex-1 min-w-0 pt-1">
                                        <div className="font-semibold text-gray-900 truncate text-lg">
                                            {localDisplayName || 'User'}
                                        </div>
                                        <div className="text-sm text-gray-500 truncate">
                                            {userEmail || 'No email set'}
                                        </div>
                                    </div>
                                </div>

                                {/* Icon Picker */}
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                        Icon
                                    </label>
                                    
                                    {/* Category Filters */}
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {(['all', 'on_theme', 'animals', 'knowledge', 'science', 'misc'] as const).map((category) => {
                                            const categoryLabels: Record<typeof category, string> = {
                                                all: 'All',
                                                on_theme: 'On-theme',
                                                animals: 'Animals',
                                                knowledge: 'Knowledge',
                                                science: 'Science',
                                                misc: 'Misc',
                                            };
                                            return (
                                                <button
                                                    key={category}
                                                    onClick={() => setSelectedCategory(category)}
                                                    className={`
                                                        px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150
                                                        ${selectedCategory === category
                                                            ? 'bg-blue-600 text-white shadow-sm'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }
                                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                                                    `}
                                                    aria-label={`Filter by ${categoryLabels[category]}`}
                                                    aria-pressed={selectedCategory === category}
                                                >
                                                    {categoryLabels[category]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    <div className="bg-white rounded-lg border border-gray-200 p-2 max-h-48 overflow-y-auto">
                                        <div className="grid grid-cols-7 sm:grid-cols-9 gap-1">
                                            {/* Default Icon */}
                                            <button
                                                onClick={() => handleUpdateIcon(null)}
                                                className={`
                                                    aspect-square flex items-center justify-center text-lg rounded-lg transition-all duration-150
                                                    ${!localSelectedIcon || localSelectedIcon === '👤'
                                                        ? 'bg-blue-100 ring-2 ring-blue-500 ring-offset-1' 
                                                        : 'hover:bg-gray-100'
                                                    }
                                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                                                `}
                                                title="Default"
                                                aria-label="Select default icon"
                                            >
                                                👤
                                            </button>
                                            
                                            {/* Filtered Emojis */}
                                            {getEmojisByCategory(selectedCategory).map(({ emoji, name }) => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleUpdateIcon(emoji)}
                                                    className={`
                                                        aspect-square flex items-center justify-center text-lg rounded-lg transition-all duration-150
                                                        ${localSelectedIcon === emoji 
                                                            ? 'bg-blue-100 ring-2 ring-blue-500 ring-offset-1' 
                                                            : 'hover:bg-gray-100'
                                                        }
                                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                                                    `}
                                                    title={name}
                                                    aria-label={`Select ${name} icon`}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Background Color Picker */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                        Background
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {(Object.keys(AVATAR_BACKGROUNDS) as AvatarBackgroundKey[]).map((key) => {
                                            const bg = AVATAR_BACKGROUNDS[key];
                                            const isSelected = localAvatarBackground === key || (!localAvatarBackground && key === 'blue');
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => handleUpdateAvatarBackground(key)}
                                                    className={`
                                                        w-9 h-9 rounded-full transition-all duration-150
                                                        ${isSelected 
                                                            ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' 
                                                            : 'hover:scale-105 opacity-80 hover:opacity-100'
                                                        }
                                                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900
                                                    `}
                                                    style={{ 
                                                        background: bg.gradient,
                                                        boxShadow: bg.shadow
                                                    }}
                                                    title={bg.name}
                                                    aria-label={`Select ${bg.name} background`}
                                                    aria-pressed={isSelected}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Display Name */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                    Display Name
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={localDisplayName}
                                            onChange={(e) => setLocalDisplayName(e.target.value.slice(0, 20))}
                                            maxLength={20}
                                            className={`
                                                w-full px-3 py-2 rounded-lg border transition-all duration-200 text-sm
                                                ${displayNameError 
                                                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                                                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                                }
                                                text-gray-900 placeholder-gray-400
                                                focus:outline-none focus:ring-2 focus:ring-offset-0
                                            `}
                                            placeholder="Enter display name"
                                            aria-invalid={displayNameError ? 'true' : 'false'}
                                            aria-describedby={displayNameError ? 'display-name-error' : 'display-name-help'}
                                        />
                                        {(displayNameError || (localDisplayName.length > 0 && localDisplayName.length < 3)) && (
                                            <p 
                                                id="display-name-error" 
                                                className="mt-1 text-xs text-red-600"
                                            >
                                                {displayNameError || 'Must be at least 3 characters'}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleUpdateDisplayName}
                                        disabled={isUpdatingDisplayName || localDisplayName.length < 3 || localDisplayName.length > 20 || localDisplayName === displayName}
                                        className="
                                            px-4 py-2 rounded-full 
                                            bg-blue-600 text-white text-sm font-medium 
                                            hover:bg-blue-700 
                                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                            disabled:opacity-50 disabled:cursor-not-allowed
                                            transition-all duration-200
                                            flex items-center gap-1.5
                                        "
                                    >
                                        {isUpdatingDisplayName ? (
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        Save
                                    </button>
                                </div>
                            </div>

                            {/* Spoiler Protection */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                        <span className="text-sm font-medium text-gray-900">Spoiler Protection</span>
                                    </div>
                                    <button
                                        onClick={() => updateSettings({ spoilerBlockEnabled: !settings.spoilerBlockEnabled })}
                                        className={`
                                            relative inline-flex h-6 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                                            transition-colors duration-200 ease-in-out 
                                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                            ${settings.spoilerBlockEnabled ? 'bg-blue-600' : 'bg-gray-300'}
                                        `}
                                        aria-label="Toggle spoiler protection"
                                        role="switch"
                                        aria-checked={settings.spoilerBlockEnabled}
                                    >
                                        <span 
                                            className={`
                                                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                                                transition duration-200 ease-in-out
                                                ${settings.spoilerBlockEnabled ? 'translate-x-4' : 'translate-x-0'}
                                            `} 
                                        />
                                    </button>
                                </div>

                                <p className="text-xs text-gray-600 mb-3">
                                    Hide questions from recent episodes to prevent spoilers
                                </p>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                                        Block episodes after
                                    </label>
                                    <input
                                        type="date"
                                        value={settings.spoilerBlockDate ? format(settings.spoilerBlockDate, 'yyyy-MM-dd') : ''}
                                        onChange={(e) => updateSettings({ spoilerBlockDate: e.target.value ? new Date(e.target.value) : null })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 text-gray-900 text-sm transition-all duration-200"
                                    />
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="border border-red-200 rounded-xl p-4 bg-red-50/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span className="text-sm font-medium text-red-900">Danger Zone</span>
                                </div>
                                <p className="text-xs text-gray-600 mb-3">
                                    Permanently delete all your game history and progress.
                                </p>
                                <button
                                    onClick={handleResetData}
                                    disabled={isResetting}
                                    className="
                                        inline-flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-full 
                                        hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        transition-all duration-200 font-medium text-xs
                                    "
                                >
                                    {isResetting ? (
                                        <>
                                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Resetting...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Reset All Data
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
