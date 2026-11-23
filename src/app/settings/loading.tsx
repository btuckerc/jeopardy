import { PageShell } from '@/components/PageShell'

export default function SettingsLoading() {
    return (
        <PageShell variant="narrow">
            <div className="mb-6 space-y-2">
                <div className="h-3.5 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="h-9 w-36 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="card p-6 sm:p-8 space-y-6 animate-pulse">
                <div className="h-32 bg-slate-100 rounded-xl" />
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="h-28 bg-slate-100 rounded-xl" />
            </div>
        </PageShell>
    )
}
