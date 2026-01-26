export default function PracticeLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="h-9 w-40 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-5 w-72 bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Practice mode cards */}
                <div className="grid md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-6 shadow animate-pulse">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
                                <div className="h-6 w-32 bg-gray-200 rounded"></div>
                            </div>
                            <div className="h-4 w-full bg-gray-100 rounded mb-2"></div>
                            <div className="h-4 w-3/4 bg-gray-100 rounded mb-4"></div>
                            <div className="h-10 w-28 bg-gray-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

