import { PageShell } from '@/components/PageShell'

export default function GameLoading() {
    return (
        <PageShell variant="workspace">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                {/* Quick Play hero skeleton matching GameHubClient */}
                <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-white via-blue-50 to-slate-50 p-6 shadow-sm sm:p-7">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="h-9 w-40 bg-slate-200 rounded-lg animate-pulse" />
                            <div className="mt-2 h-4 w-80 max-w-full bg-slate-200 rounded animate-pulse" />
                        </div>
                        <div className="h-9 w-36 bg-slate-200 rounded-full animate-pulse" />
                    </div>
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-44 bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                                <div className="h-12 w-12 bg-slate-200 rounded-xl mb-4" />
                                <div className="h-5 w-28 bg-slate-200 rounded mb-2" />
                                <div className="h-4 w-full bg-slate-100 rounded" />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Workspace surface skeleton */}
                <section className="workspace-surface p-5 md:p-6">
                    <div className="h-6 w-56 bg-slate-200 rounded animate-pulse mb-4" />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-6">
                        <div className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                        <div className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                    </div>
                    <div className="space-y-3">
                        <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                        <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                    </div>
                </section>
            </div>
        </PageShell>
    )
}
