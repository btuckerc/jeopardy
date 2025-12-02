export default function GameLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header skeleton */}
                <div className="mb-8">
                    <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
                </div>

                {/* Resumable games skeleton */}
                <div className="mb-8">
                    <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
                    <div className="space-y-3">
                        {[1, 2].map((i) => (
                            <div key={i} className="card p-4 animate-pulse">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="h-5 w-48 bg-gray-200 rounded mb-2"></div>
                                        <div className="h-4 w-32 bg-gray-200 rounded"></div>
                                    </div>
                                    <div className="h-8 w-20 bg-gray-200 rounded"></div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <div className="h-1.5 bg-gray-200 rounded-full"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* New game section skeleton */}
                <div className="card p-6">
                    <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-6"></div>
                    <div className="space-y-6">
                        <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
                            ))}
                        </div>
                        <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
                        <div className="flex justify-end">
                            <div className="h-12 w-32 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

