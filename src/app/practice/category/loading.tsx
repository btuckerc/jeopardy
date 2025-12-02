export default function PracticeCategoryLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="container mx-auto">
                {/* Header skeleton */}
                <div className="mb-8">
                    <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2"></div>
                </div>

                {/* Categories grid skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-40 bg-gray-200 rounded-lg animate-pulse"></div>
                    ))}
                </div>
            </div>
        </div>
    )
}

