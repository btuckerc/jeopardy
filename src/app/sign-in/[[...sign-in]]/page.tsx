import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Sign In to trivrdy | Jeopardy Practice Game',
    description: 'Sign in to trivrdy to track your progress, compete on the leaderboard, and save your Jeopardy game statistics.',
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        title: 'Sign In to trivrdy | Jeopardy Practice Game',
        description: 'Sign in to trivrdy to track your progress and compete on the leaderboard.',
        url: 'https://trivrdy.com/sign-in',
        type: 'website',
    },
    alternates: {
        canonical: 'https://trivrdy.com/sign-in',
    },
}

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect_url?: string }>
}) {
    const params = await searchParams
    const redirectUrl = params?.redirect_url || '/'
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sign in to trivrdy
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Track your progress and compete on the leaderboard
                    </p>
                </div>

                <div className="flex justify-center">
                    <SignIn
                        appearance={{
                            elements: {
                                rootBox: "w-full",
                                card: "shadow-none w-full",
                                formButtonPrimary: "bg-blue-600 hover:bg-blue-700",
                                footerActionLink: "text-blue-600 hover:text-blue-800"
                            }
                        }}
                        routing="path"
                        path="/sign-in"
                        signUpUrl={`/sign-up${redirectUrl !== '/' ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ''}`}
                        afterSignInUrl={redirectUrl}
                    />
                </div>

                <p className="mt-6 text-center text-xs text-gray-500">
                    By signing in, you agree to our terms of service.
                </p>

                <div className="text-center">
                    <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
                        ← Back to home
                    </Link>
                </div>
            </div>
        </div>
    )
}

