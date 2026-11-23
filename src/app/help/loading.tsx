export default function HelpLoading() {
    return (
        <div className="flex-1 w-full bg-slate-100">
            <div className="surface-immersive border-t border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                    <div className="h-3.5 w-20 bg-white/20 rounded animate-pulse mb-2" />
                    <div className="h-10 w-56 bg-white/20 rounded-lg animate-pulse mb-3" />
                    <div className="h-5 w-96 max-w-full bg-white/15 rounded animate-pulse" />
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 sm:pt-8 sm:pb-14 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-pulse h-56" />
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-pulse h-80" />
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-pulse space-y-4">
                    <div className="h-7 w-64 bg-slate-200 rounded" />
                    <div className="h-4 w-full bg-slate-100 rounded" />
                    <div className="h-4 w-5/6 bg-slate-100 rounded" />
                </div>
            </div>
        </div>
    )
}
