'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import toast from 'react-hot-toast';

interface Props {
    userId: string;
    spoilerBlockEnabled?: boolean;
    spoilerBlockDate?: string | null;
}

export default function SpoilerSettings({ userId, spoilerBlockEnabled = true, spoilerBlockDate }: Props) {
    const [isEnabled, setIsEnabled] = useState(spoilerBlockEnabled);
    const [blockDate, setBlockDate] = useState(spoilerBlockDate || '');
    const supabase = createClientComponentClient();

    const handleToggle = async () => {
        try {
            const { error } = await supabase.auth.updateUser({
                data: { spoilerBlockEnabled: !isEnabled }
            });

            if (error) throw error;

            setIsEnabled(!isEnabled);
            toast.success('Spoiler settings updated');
        } catch (error) {
            console.error('Error updating spoiler settings:', error);
            toast.error('Failed to update spoiler settings');
        }
    };

    const handleDateChange = async (date: string) => {
        try {
            const { error } = await supabase.auth.updateUser({
                data: { spoilerBlockDate: date || null }
            });

            if (error) throw error;

            setBlockDate(date);
            toast.success('Block date updated');
        } catch (error) {
            console.error('Error updating block date:', error);
            toast.error('Failed to update block date');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Block Recent Questions</h3>
                    <p className="text-sm text-gray-500">
                        When enabled, questions that aired after your block date won&apos;t appear
                    </p>
                </div>
                <button
                    onClick={handleToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                >
                    <span className="sr-only">Enable spoiler blocking</span>
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>

            {isEnabled && (
                <div>
                    <label htmlFor="blockDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Block questions after
                    </label>
                    <input
                        type="date"
                        id="blockDate"
                        value={blockDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>
            )}
        </div>
    );
} 