export default function StatsLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="h-9 w-40 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-5 w-64 bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-4 shadow animate-pulse">
                            <div className="h-4 w-20 bg-gray-200 rounded mb-2"></div>
                            <div className="h-8 w-16 bg-gray-200 rounded"></div>
                        </div>
                    ))}
                </div>
                
                {/* Charts skeleton */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl p-6 shadow animate-pulse">
                        <div className="h-5 w-32 bg-gray-200 rounded mb-4"></div>
                        <div className="h-48 bg-gray-100 rounded"></div>
                    </div>
                    <div className="bg-white rounded-xl p-6 shadow animate-pulse">
                        <div className="h-5 w-32 bg-gray-200 rounded mb-4"></div>
                        <div className="h-48 bg-gray-100 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}

