import { PageShell } from '@/components/PageShell'

export default function StatsLoading() {
    return (
        <PageShell>
            <div className="mb-6 space-y-2">
                <div className="h-3.5 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="h-9 w-52 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
            </div>

            <div className="flex gap-2 pb-3 mb-6 border-b border-slate-200">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 w-28 bg-white border border-slate-200 rounded-full animate-pulse" />
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-pulse">
                        <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                        <div className="h-9 w-20 bg-slate-200 rounded mb-2" />
                        <div className="h-3 w-36 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-pulse">
                    <div className="h-5 w-36 bg-slate-200 rounded mb-4" />
                    <div className="h-48 bg-slate-100 rounded-xl" />
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-pulse">
                    <div className="h-5 w-36 bg-slate-200 rounded mb-4" />
                    <div className="h-48 bg-slate-100 rounded-xl" />
                </div>
            </div>
        </PageShell>
    )
}
