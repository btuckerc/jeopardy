export default function HomeLoading() {
    return (
        <div className="relative flex-1 w-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-amber-50/70">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-8 sm:pb-14">
                {/* Header skeleton */}
                <div className="text-center max-w-3xl mx-auto">
                    <div className="h-9 w-56 mx-auto bg-slate-200 rounded-lg animate-pulse mb-2.5" />
                    <div className="h-14 w-44 mx-auto bg-slate-200 rounded-xl animate-pulse mb-4" />
                    <div className="h-5 w-96 max-w-full mx-auto bg-slate-200 rounded animate-pulse" />
                </div>

                {/* Stats skeleton */}
                <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
                    ))}
                </div>

                {/* Daily Challenge Card skeleton */}
                <div className="mt-6 sm:mt-8 max-w-4xl mx-auto">
                    <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
                </div>

                {/* Mode Cards skeleton */}
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
                    <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
                    <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
                </div>
            </div>
        </div>
    )
}
