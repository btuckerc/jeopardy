import Link from 'next/link'
import { getAppUser } from '@/lib/clerk-auth'
import FriendsClient from './FriendsClient'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Friends | Social Features - trivrdy',
    description: 'Challenge friends and compare trivia progress together.',
}

export default async function FriendsPage() {
    const user = await getAppUser()

    if (!user) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-md mx-auto">
                    <div className="card text-center p-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">Friends</h1>
                        <p className="text-gray-600 mb-6">
                            Sign in to connect with friends, send challenges, and compare your progress.
                        </p>
                        <Link href="/sign-in?redirect_url=/friends" className="btn-primary">
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return <FriendsClient user={user} />
}
