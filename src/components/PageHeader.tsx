import type { ReactNode } from 'react'

interface PageHeaderProps {
    title: ReactNode
    subtitle?: ReactNode
    kicker?: string
    icon?: ReactNode
    actions?: ReactNode
    className?: string
}

export function PageHeader({
    title,
    subtitle,
    kicker,
    icon,
    actions,
    className = '',
}: PageHeaderProps) {
    return (
        <header className={`mb-6 md:mb-8 ${className}`.trim()}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 flex-1">
                    {kicker ? (
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                            {kicker}
                        </p>
                    ) : null}
                    <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                        {icon ? <span className="shrink-0" aria-hidden="true">{icon}</span> : null}
                        <span>{title}</span>
                    </h1>
                    {subtitle ? (
                        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
                {actions ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                        {actions}
                    </div>
                ) : null}
            </div>
        </header>
    )
}
