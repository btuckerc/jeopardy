export default function LeaderboardLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="h-10 w-48 mx-auto bg-gray-200 rounded animate-pulse mb-4"></div>
                    <div className="h-5 w-72 mx-auto bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Tabs skeleton */}
                <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse"></div>
                    ))}
                </div>
                
                {/* Leaderboard table skeleton */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    {/* Table header */}
                    <div className="bg-gray-50 px-6 py-3 flex gap-4">
                        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse flex-1"></div>
                        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    
                    {/* Table rows */}
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                        <div key={i} className="px-6 py-4 border-t border-gray-100 flex items-center gap-4">
                            <div className="h-6 w-8 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse flex-1"></div>
                            <div className="h-5 w-16 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

