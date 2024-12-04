'use client'

import { useState } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import SpoilerSettings from '@/components/SpoilerSettings';

export default async function SettingsPage() {
    const [isOpen, setIsOpen] = useState(false);
    const session = await getServerSession();

    if (!session?.user) {
        redirect('/api/auth/signin');
    }

    return (
        <main className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-8">Settings</h1>

            <div className="max-w-2xl">
                <SpoilerSettings isOpen={isOpen} onClose={() => setIsOpen(false)} />

                {/* Add other settings components here */}
            </div>
        </main>
    );
} 