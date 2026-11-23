import { PageShell } from '@/components/PageShell'

export default function TripleStumpersLoading() {
    return (
        <PageShell>
            <div className="mb-6 space-y-3">
                <div className="h-10 w-44 bg-white border border-slate-200 rounded-full animate-pulse" />
                <div className="h-8 w-52 bg-slate-200 rounded-lg animate-pulse" />
            </div>
            <div className="h-14 bg-amber-100/70 rounded-xl mb-6 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-40 bg-white border border-slate-200 rounded-2xl animate-pulse" />
                ))}
            </div>
        </PageShell>
    )
}
