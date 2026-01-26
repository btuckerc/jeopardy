export default function HomeLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header skeleton */}
                <div className="text-center mb-8 md:mb-12">
                    <div className="h-12 w-64 mx-auto bg-white/10 rounded animate-pulse mb-4"></div>
                    <div className="h-6 w-96 max-w-full mx-auto bg-white/10 rounded animate-pulse"></div>
                </div>
                
                {/* Stats cards skeleton */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 animate-pulse">
                            <div className="h-8 w-16 bg-white/20 rounded mb-2"></div>
                            <div className="h-4 w-24 bg-white/10 rounded"></div>
                        </div>
                    ))}
                </div>
                
                {/* Main action buttons skeleton */}
                <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                    <div className="h-24 bg-white/10 backdrop-blur-sm rounded-xl animate-pulse"></div>
                    <div className="h-24 bg-white/10 backdrop-blur-sm rounded-xl animate-pulse"></div>
                </div>
            </div>
        </div>
    )
}

