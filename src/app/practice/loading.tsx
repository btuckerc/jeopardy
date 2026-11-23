import { PageShell } from '@/components/PageShell'

export default function PracticeLoading() {
    return (
        <PageShell>
            <div className="mb-6 md:mb-8 space-y-2">
                <div className="h-3.5 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="h-9 w-44 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-5 w-96 max-w-full bg-slate-200 rounded animate-pulse" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-pulse">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-14 w-14 bg-slate-200 rounded-xl" />
                            <div className="h-6 w-36 bg-slate-200 rounded" />
                        </div>
                        <div className="h-4 w-full bg-slate-100 rounded mb-2" />
                        <div className="h-4 w-3/4 bg-slate-100 rounded mb-6" />
                        <div className="h-5 w-24 bg-slate-200 rounded" />
                    </div>
                ))}
            </div>
        </PageShell>
    )
}
