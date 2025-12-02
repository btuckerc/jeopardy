export default function GameLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header skeleton */}
                <div className="mb-8">
                    <div className="h-9 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-5 w-80 bg-gray-200 rounded animate-pulse"></div>
                </div>

                {/* Resumable games skeleton */}
                <div className="mb-8">
                    <div className="h-7 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
                    <div className="card p-6 text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-2"></div>
                        <p className="text-gray-500">Loading your games...</p>
                    </div>
                </div>

                {/* New game section skeleton */}
                <div className="card p-6">
                    <div className="h-7 w-40 bg-gray-200 rounded animate-pulse mb-6"></div>
                    <div className="space-y-6">
                        {/* Mode selector skeleton */}
                        <div>
                            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-3"></div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
                                ))}
                            </div>
                        </div>
                        {/* Rounds skeleton */}
                        <div>
                            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse mb-3"></div>
                            <div className="flex gap-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                                ))}
                            </div>
                        </div>
                        {/* Button skeleton */}
                        <div className="flex justify-end pt-4">
                            <div className="h-12 w-32 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

