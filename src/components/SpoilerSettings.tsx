'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { format, subMonths, subYears } from 'date-fns';

interface Props {
    userId: string;
}

interface QuestionStats {
    totalQuestions: number;
    availableQuestions: number;
    blockedQuestions: number;
}

export default function SpoilerSettings({ userId: _userId }: Props) {
    const [isEnabled, setIsEnabled] = useState(false);
    const [blockDate, setBlockDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<QuestionStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // Quick date presets
    const presets = [
        { label: '1 month ago', getValue: () => format(subMonths(new Date(), 1), 'yyyy-MM-dd') },
        { label: '3 months ago', getValue: () => format(subMonths(new Date(), 3), 'yyyy-MM-dd') },
        { label: '6 months ago', getValue: () => format(subMonths(new Date(), 6), 'yyyy-MM-dd') },
        { label: '1 year ago', getValue: () => format(subYears(new Date(), 1), 'yyyy-MM-dd') },
    ];

    // Fetch current settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch('/api/user/spoiler-settings');
                if (response.ok) {
                    const data = await response.json();
                    setIsEnabled(data.spoilerBlockEnabled ?? false);
                    setBlockDate(data.spoilerBlockDate ? new Date(data.spoilerBlockDate).toISOString().split('T')[0] : '');
                }
            } catch (error) {
                console.error('Error fetching spoiler settings:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // Fetch question availability stats when settings change
    useEffect(() => {
        const fetchStats = async () => {
            if (!isEnabled || !blockDate) {
                setStats(null);
                return;
            }
            
            setLoadingStats(true);
            try {
                const response = await fetch(`/api/user/spoiler-settings/stats?date=${blockDate}`);
                if (response.ok) {
                    const data = await response.json();
                    setStats(data);
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoadingStats(false);
            }
        };
        
        fetchStats();
    }, [isEnabled, blockDate]);

    const handleToggle = async () => {
        try {
            const response = await fetch('/api/user/spoiler-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spoilerBlockEnabled: !isEnabled })
            });

            if (!response.ok) throw new Error('Failed to update');

            setIsEnabled(!isEnabled);
            toast.success(isEnabled ? 'Episode protection disabled' : 'Episode protection enabled');
        } catch (error) {
            console.error('Error updating spoiler settings:', error);
            toast.error('Failed to update settings');
        }
    };

    const handleDateChange = async (date: string) => {
        try {
            const response = await fetch('/api/user/spoiler-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spoilerBlockDate: date || null })
            });

            if (!response.ok) throw new Error('Failed to update');

            setBlockDate(date);
            toast.success('Date updated');
        } catch (error) {
            console.error('Error updating block date:', error);
            toast.error('Failed to update date');
        }
    };

    if (loading) {
        return <div className="animate-pulse h-32 bg-gray-200 rounded" />;
    }

    return (
        <div className="space-y-6">
            {/* Main Toggle */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">Episode Spoiler Protection</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Avoid seeing questions from episodes you haven&apos;t watched yet. 
                        Only questions that aired <strong>before</strong> your cutoff date will appear.
                    </p>
                </div>
                <button
                    onClick={handleToggle}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                >
                    <span className="sr-only">Enable episode protection</span>
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            {isEnabled && (
                <div className="space-y-4 pl-0 border-l-4 border-blue-200 bg-blue-50 p-4 rounded-r-lg">
                    {/* Date Picker */}
                    <div>
                        <label htmlFor="blockDate" className="block text-sm font-medium text-gray-700">
                            Show questions from episodes that aired before:
                        </label>
                        <input
                            type="date"
                            id="blockDate"
                            value={blockDate}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>

                    {/* Quick Presets */}
                    <div>
                        <p className="text-xs text-gray-500 mb-2">Quick select:</p>
                        <div className="flex flex-wrap gap-2">
                            {presets.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => handleDateChange(preset.getValue())}
                                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                                        blockDate === preset.getValue()
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stats Display */}
                    {blockDate && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                            {loadingStats ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                                    Calculating available questions...
                                </div>
                            ) : stats ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Available questions:</span>
                                        <span className="font-medium text-green-600">
                                            {stats.availableQuestions.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Hidden (too recent):</span>
                                        <span className="font-medium text-amber-600">
                                            {stats.blockedQuestions.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                        <div
                                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                            style={{ 
                                                width: `${stats.totalQuestions > 0 
                                                    ? (stats.availableQuestions / stats.totalQuestions) * 100 
                                                    : 0}%` 
                                            }}
                                        />
                                    </div>
                                    
                                    {stats.availableQuestions === 0 && (
                                        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                                            <strong>No questions available!</strong> Try selecting an earlier date 
                                            or disable episode protection to access all questions.
                                        </div>
                                    )}
                                    
                                    {stats.availableQuestions > 0 && stats.availableQuestions < 100 && (
                                        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                                            Only {stats.availableQuestions} questions available. Consider selecting 
                                            an earlier date for more variety.
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )}

                    {!blockDate && (
                        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                            ⚠️ Please select a date. Without a date, all questions from today and earlier will be shown.
                        </p>
                    )}
                </div>
            )}

            {/* Info when disabled */}
            {!isEnabled && (
                <p className="text-sm text-gray-500 italic">
                    All questions are currently available, including those from recent episodes.
                </p>
            )}
        </div>
    );
}
