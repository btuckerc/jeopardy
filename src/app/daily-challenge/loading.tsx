export default function DailyChallengeLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="h-10 w-64 mx-auto bg-white/10 rounded animate-pulse mb-4"></div>
                    <div className="h-6 w-48 mx-auto bg-white/10 rounded animate-pulse"></div>
                </div>
                
                {/* Challenge card skeleton */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 animate-pulse">
                    <div className="h-6 w-32 bg-white/20 rounded mb-4"></div>
                    <div className="h-32 bg-white/10 rounded mb-4"></div>
                    <div className="flex justify-center gap-4">
                        <div className="h-12 w-32 bg-white/20 rounded"></div>
                    </div>
                </div>
                
                {/* Leaderboard skeleton */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <div className="h-6 w-40 bg-white/20 rounded mb-4"></div>
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-12 bg-white/10 rounded animate-pulse"></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

