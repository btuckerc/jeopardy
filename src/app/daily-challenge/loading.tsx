export default function DailyChallengeLoading() {
    return (
        <div className="flex-1 w-full surface-immersive py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="h-9 w-40 mx-auto bg-amber-400/30 rounded-full animate-pulse mb-6" />
                    <div className="h-28 bg-white/10 rounded-2xl animate-pulse" />
                </div>

                {/* Challenge card skeleton */}
                <div className="bg-white/10 rounded-2xl p-6 sm:p-8 mb-8 animate-pulse">
                    <div className="h-6 w-32 bg-white/20 rounded mb-4 mx-auto" />
                    <div className="h-24 bg-white/10 rounded-xl mb-6" />
                    <div className="flex justify-center">
                        <div className="h-12 w-44 bg-amber-400/30 rounded-xl" />
                    </div>
                </div>

                {/* Leaderboard skeleton */}
                <div className="bg-white/10 rounded-2xl p-6">
                    <div className="h-6 w-40 bg-white/20 rounded mb-4" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-12 bg-white/10 rounded-xl animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
