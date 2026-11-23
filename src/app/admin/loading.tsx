import { PageShell } from '@/components/PageShell'

export default function AdminLoading() {
    return (
        <PageShell variant="workspace">
            <div className="workspace-shell">
                <aside className="workspace-sidebar">
                    <div className="workspace-sidebar-card p-4 space-y-3 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-10 bg-slate-100 rounded-xl" />
                        ))}
                    </div>
                </aside>
                <div className="workspace-main">
                    <div className="workspace-surface p-6 animate-pulse">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-slate-50 rounded-xl p-4">
                                    <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
                                    <div className="h-8 w-16 bg-slate-200 rounded" />
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-12 bg-slate-50 rounded-xl" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    )
}
