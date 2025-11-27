import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignInPage() {
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
                        signUpUrl="/sign-up"
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

