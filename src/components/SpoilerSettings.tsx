'use client';

import { useState, useEffect } from 'react';
import { format, subWeeks } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface SpoilerSettings {
    spoilerBlockDate: Date | null;
    spoilerBlockEnabled: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function SpoilerSettings({ isOpen, onClose }: Props) {
    const [settings, setSettings] = useState<SpoilerSettings>({
        spoilerBlockDate: null,
        spoilerBlockEnabled: true
    });
    const [showPrompt, setShowPrompt] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    // Fetch current settings
    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user?.id) {
                    setError("Please sign in to manage settings");
                    return;
                }

                const response = await fetch(`/api/user/spoiler-settings?userId=${user.id}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch settings');
                }
                const data = await response.json();

                setSettings({
                    spoilerBlockDate: data.spoilerBlockDate ? new Date(data.spoilerBlockDate) : null,
                    spoilerBlockEnabled: data.spoilerBlockEnabled
                });

                // Check if we should show the update prompt
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
            fetchSettings();
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

            const data = await response.json();
            setSettings(prev => ({ ...prev, ...newSettings }));
            setShowPrompt(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Spoiler Protection Settings</h2>
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

                {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <>
                        {showPrompt && (
                            <div className="mb-4 p-4 bg-yellow-100 rounded">
                                <p>We noticed your spoiler block is set to {settings.spoilerBlockDate ? format(settings.spoilerBlockDate, 'PPP') : 'disabled'}.</p>
                                <p>Are you caught up and would like to update this?</p>
                                <div className="mt-2 space-x-2">
                                    <button
                                        onClick={() => updateSettings({ spoilerBlockDate: new Date() })}
                                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                    >
                                        Update to Today
                                    </button>
                                    <button
                                        onClick={() => updateSettings({ spoilerBlockDate: null })}
                                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                    >
                                        Disable Block
                                    </button>
                                    <button
                                        onClick={() => setShowPrompt(false)}
                                        className="text-gray-600 hover:text-gray-800"
                                    >
                                        Ask Later
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Block Questions After Date
                                </label>
                                <input
                                    type="date"
                                    value={settings.spoilerBlockDate ? format(settings.spoilerBlockDate, 'yyyy-MM-dd') : ''}
                                    onChange={(e) => updateSettings({
                                        spoilerBlockDate: e.target.value ? new Date(e.target.value) : null
                                    })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                                <p className="mt-1 text-sm text-gray-500">
                                    Questions from episodes after this date will be hidden
                                </p>
                            </div>

                            <div>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.spoilerBlockEnabled}
                                        onChange={(e) => updateSettings({ spoilerBlockEnabled: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2">Hide Today's Questions</span>
                                </label>
                                <p className="mt-1 text-sm text-gray-500">
                                    Prevents spoilers from today's episode
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
} 