'use client'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'

export default async function SettingsPage() {
    const supabase = createServerComponentClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-8">Settings</h1>
            <div className="bg-white rounded-lg shadow p-6">
                <UserAvatar />
            </div>
        </div>
    )
} 