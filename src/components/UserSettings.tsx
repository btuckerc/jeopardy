'use client';

import { useState, useEffect } from 'react';
import { format, subWeeks } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import UserAvatar from './UserAvatar'
import { PROFILE_ICONS } from './UserAvatar'

interface SpoilerSettings {
    spoilerBlockDate: Date | null;
    spoilerBlockEnabled: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onDisplayNameUpdate: (displayName: string) => void;
    onIconUpdate?: (icon: string | null) => void;
}

export default function UserSettings({ isOpen, onClose, onDisplayNameUpdate, onIconUpdate }: Props) {
    const [settings, setSettings] = useState<SpoilerSettings>({
        spoilerBlockDate: null,
        spoilerBlockEnabled: true
    });
    const [showPrompt, setShowPrompt] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [displayName, setDisplayName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
    const [displayNameError, setDisplayNameError] = useState<string | null>(null);
    const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);
    const supabase = createClientComponentClient();
    const router = useRouter();

    useEffect(() => {
        const fetchUserData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user?.id) {
                    setError("Please sign in to manage settings");
                    return;
                }

                setUserEmail(user.email || '');

                // Fetch display name and selected icon
                const displayNameResponse = await fetch(`/api/user/display-name`);
                if (displayNameResponse.ok) {
                    const data = await displayNameResponse.json();
                    setDisplayName(data.displayName || '');
                    setSelectedIcon(data.selectedIcon || null);
                }

                // Fetch spoiler settings
                const response = await fetch(`/api/user/spoiler-settings?userId=${user.id}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch settings');
                }
                const data = await response.json();

                setSettings({
                    spoilerBlockDate: data.spoilerBlockDate ? new Date(data.spoilerBlockDate) : null,
                    spoilerBlockEnabled: data.spoilerBlockEnabled
                });

                const twoWeeksAgo = subWeeks(new Date(), 2);
                if (
                    data.spoilerBlockDate &&
                    new Date(data.spoilerBlockDate) < twoWeeksAgo &&
                    (!data.lastSpoilerPrompt ||
                        new Date(data.lastSpoilerPrompt) < subWeeks(new Date(), 1))
                ) {
                    setShowPrompt(true);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            fetchUserData();
        }
    }, [isOpen, supabase]);

    const updateSettings = async (newSettings: Partial<SpoilerSettings>) => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.id) {
                setError("Please sign in to update settings");
                return;
            }

            const response = await fetch('/api/user/spoiler-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    ...newSettings,
                    lastSpoilerPrompt: new Date()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update settings');
            }

            setSettings(prev => ({ ...prev, ...newSettings }));
            setShowPrompt(false);
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

            // Clear local storage
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
                body: JSON.stringify({ displayName })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update display name')
            }

            const data = await response.json()
            setDisplayName(data.displayName)
            onDisplayNameUpdate(data.displayName)
        } catch (err) {
            setDisplayNameError(err instanceof Error ? err.message : 'Failed to update display name')
        } finally {
            setIsUpdatingDisplayName(false)
        }
    }

    const handleUpdateIcon = async (icon: string | null) => {
        setSelectedIcon(icon);
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
            if (onIconUpdate) {
                onIconUpdate(data.selectedIcon);
            }
        } catch (err) {
            console.error('Error updating icon:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">User Settings</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
                        {error}
                    </div>
                )}

                {!isLoading && (
                    <div className="space-y-8">
                        {/* Profile Section */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Settings</h3>

                            {/* Icon Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Profile Icon
                                </label>
                                <div className="flex items-center gap-4">
                                    <UserAvatar
                                        email={userEmail}
                                        displayName={displayName}
                                        selectedIcon={selectedIcon}
                                        size="lg"
                                    />
                                    <div className="grid grid-cols-5 gap-2 flex-1">
                                        <button
                                            onClick={() => handleUpdateIcon(null)}
                                            className={`p-2 rounded-md text-gray-900 ${!selectedIcon ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                                            title="Default"
                                        >
                                            👤
                                        </button>
                                        {Object.entries(PROFILE_ICONS).map(([icon, name]) => (
                                            <button
                                                key={icon}
                                                onClick={() => handleUpdateIcon(icon)}
                                                className={`p-2 rounded-md text-gray-900 ${selectedIcon === icon ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                                                title={name}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Display Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Display Name
                                </label>
                                <div className="flex rounded-md shadow-sm">
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
                                        maxLength={20}
                                        className="flex-1 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                                        placeholder="Enter display name"
                                    />
                                    <button
                                        onClick={handleUpdateDisplayName}
                                        disabled={isUpdatingDisplayName || displayName.length < 3 || displayName.length > 20}
                                        className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                                    >
                                        {isUpdatingDisplayName ? 'Updating...' : 'Update'}
                                    </button>
                                </div>
                                <div className="mt-1 flex justify-between text-sm">
                                    <span className={displayName.length > 20 ? 'text-red-600' : 'text-gray-500'}>
                                        {displayName.length}/20 characters
                                    </span>
                                    {displayNameError && (
                                        <span className="text-red-600">{displayNameError}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Spoiler Protection */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Spoiler Protection</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="font-medium text-gray-900">Block Today's Questions</label>
                                        <p className="text-sm text-gray-500">Prevent spoilers from today's episode</p>
                                    </div>
                                    <button
                                        onClick={() => updateSettings({ spoilerBlockEnabled: !settings.spoilerBlockEnabled })}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${settings.spoilerBlockEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.spoilerBlockEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div>
                                    <label className="font-medium text-gray-900">Block Questions Before</label>
                                    <p className="text-sm text-gray-500 mb-2">Hide questions from episodes you haven't watched yet</p>
                                    <input
                                        type="date"
                                        value={settings.spoilerBlockDate ? format(settings.spoilerBlockDate, 'yyyy-MM-dd') : ''}
                                        onChange={(e) => updateSettings({ spoilerBlockDate: e.target.value ? new Date(e.target.value) : null })}
                                        className="rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Reset Data */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h3>
                            <button
                                onClick={handleResetData}
                                disabled={isResetting}
                                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                            >
                                {isResetting ? 'Resetting...' : 'Reset All Data'}
                            </button>
                            <p className="mt-2 text-sm text-gray-500">
                                This will reset all your game history and statistics. This action cannot be undone.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 