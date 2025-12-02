export default function PracticeRoundLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="container mx-auto">
                {/* Header skeleton */}
                <div className="mb-8">
                    <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
                </div>

                {/* Round cards skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
                    ))}
                </div>
            </div>
        </div>
    )
}

