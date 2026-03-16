'use client'

import { ADMIN_REPORTING_WINDOWS, type AdminReportingWindow } from '../lib/reporting'

interface AdminRangeToolbarProps {
    title: string
    value: AdminReportingWindow
    onChange: (value: AdminReportingWindow) => void
}

export function AdminRangeToolbar({ title, value, onChange }: AdminRangeToolbarProps) {
    return (
        <section className="workspace-main-header">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h1 className="workspace-main-title">{title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex flex-wrap items-center gap-2 rounded-[1.75rem] border border-slate-200 bg-slate-50/90 p-1">
                        {ADMIN_REPORTING_WINDOWS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onChange(option.value)}
                                className={`rounded-[1.15rem] px-4 py-2 text-sm font-semibold transition-colors ${
                                    value === option.value
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                                }`}
                                aria-pressed={value === option.value}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
