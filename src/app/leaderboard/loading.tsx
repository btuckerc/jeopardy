import { PageShell } from '@/components/PageShell'

export default function LeaderboardLoading() {
    return (
        <PageShell>
            <div className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2.5">
                    <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                    <div className="h-9 w-64 bg-slate-200 rounded-lg animate-pulse" />
                    <div className="flex gap-2 pt-1">
                        <div className="h-9 w-20 bg-slate-200 rounded-lg animate-pulse" />
                        <div className="h-9 w-20 bg-slate-200 rounded-lg animate-pulse" />
                    </div>
                </div>
                <div className="h-28 w-full md:w-56 bg-white rounded-2xl border border-slate-200 p-4 animate-pulse" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 flex gap-4 border-b border-slate-200">
                    <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse flex-1" />
                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                </div>

                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="px-6 py-4 border-t border-slate-100 flex items-center gap-4">
                        <div className="h-6 w-8 bg-slate-200 rounded animate-pulse" />
                        <div className="h-10 w-10 bg-slate-200 rounded-full animate-pulse" />
                        <div className="h-5 w-40 bg-slate-200 rounded animate-pulse flex-1" />
                        <div className="h-5 w-20 bg-slate-200 rounded animate-pulse" />
                    </div>
                ))}
            </div>
        </PageShell>
    )
}
