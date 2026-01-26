export default function AdminLoading() {
    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Tabs skeleton */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
                    ))}
                </div>
                
                {/* Content skeleton */}
                <div className="bg-white rounded-lg shadow p-6">
                    {/* Metric cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
                                <div className="h-4 w-20 bg-gray-200 rounded mb-2"></div>
                                <div className="h-8 w-16 bg-gray-200 rounded"></div>
                            </div>
                        ))}
                    </div>
                    
                    {/* Table skeleton */}
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-12 bg-gray-50 rounded animate-pulse"></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

