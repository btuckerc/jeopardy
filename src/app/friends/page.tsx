import Link from 'next/link'
import { Metadata } from 'next'
import { getAppUser } from '@/lib/clerk-auth'
import { getFriendInviteByToken } from '@/lib/friends'
import FriendsClient from './FriendsClient'

type SearchParams = Record<string, string | string[] | undefined>

function getInviteToken(value: string | string[] | undefined): string | null {
    if (typeof value === 'string' && value.trim()) {
        return value.trim()
    }

    return null
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams?: Promise<SearchParams> | SearchParams
}): Promise<Metadata> {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const inviteToken = getInviteToken(resolvedSearchParams.invite)

    if (!inviteToken) {
        return {
            title: 'Friends | Social Features - trivrdy',
            description: 'Add friends, compare daily challenge results, and send head-to-head Jeopardy boards.',
            openGraph: {
                title: 'Friends | Social Features - trivrdy',
                description: 'Add friends, compare daily challenge results, and send head-to-head Jeopardy boards.',
                url: 'https://trivrdy.com/friends',
                type: 'website',
            },
            twitter: {
                card: 'summary_large_image',
                title: 'Friends | Social Features - trivrdy',
                description: 'Add friends, compare daily challenge results, and send head-to-head Jeopardy boards.',
            },
        }
    }

    const inviter = await getFriendInviteByToken(inviteToken)
    const inviterName = inviter?.displayName || 'A friend'
    const title = `${inviterName} invited you to trivrdy`
    const description = `Open ${inviterName}'s invite to connect on trivrdy, compare daily challenge results, and trade head-to-head boards.`

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: `https://trivrdy.com/friends?invite=${encodeURIComponent(inviteToken)}`,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
    }
}

export default async function FriendsPage({
    searchParams,
}: {
    searchParams?: Promise<SearchParams> | SearchParams
}) {
    const user = await getAppUser()
    const resolvedSearchParams = searchParams ? await searchParams : {}

    if (!user) {
        const redirectParams = new URLSearchParams()
        redirectParams.set('tab', 'connect')

        const inviteParam = getInviteToken(resolvedSearchParams.invite)
        if (inviteParam) {
            redirectParams.set('invite', inviteParam)
        }

        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-md mx-auto">
                    <div className="card text-center p-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-3">Friends</h1>
                        <p className="text-gray-600 mb-6">
                            Sign in to connect with friends, send challenges, and compare your progress.
                        </p>
                        <Link
                            href={`/sign-in?redirect_url=${encodeURIComponent(`/friends?${redirectParams.toString()}`)}`}
                            className="btn-primary"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return <FriendsClient user={user} />
}
