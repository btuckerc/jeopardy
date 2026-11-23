import { PageShell } from '@/components/PageShell'

export default function PracticeRoundLoading() {
    return (
        <PageShell>
            <div className="mb-6 space-y-3">
                <div className="h-10 w-44 bg-white border border-slate-200 rounded-full animate-pulse" />
                <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-60 bg-white border border-slate-200 rounded-2xl animate-pulse" />
                ))}
            </div>
        </PageShell>
    )
}
