import Link from 'next/link'

export default function VerifyRequestPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 text-center">
                <div>
                    <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-100">
                        <svg
                            className="h-8 w-8 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Check your email
                    </h2>
                    <p className="mt-4 text-gray-600">
                        A sign in link has been sent to your email address.
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        Click the link in the email to complete your sign in.
                    </p>
                </div>

                <div className="mt-8 space-y-4">
                    <p className="text-sm text-gray-500">
                        Didn&apos;t receive an email? Check your spam folder or try again.
                    </p>
                    <Link
                        href="/auth/signin"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Try again
                    </Link>
                </div>

                <div className="mt-6">
                    <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
                        ← Back to home
                    </Link>
                </div>
            </div>
        </div>
    )
}

