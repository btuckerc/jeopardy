import type { ReactNode } from 'react'

export type PageShellVariant = 'default' | 'narrow' | 'workspace' | 'bleed'

interface PageShellProps {
    children: ReactNode
    variant?: PageShellVariant
    className?: string
    innerClassName?: string
}

const variantClasses: Record<Exclude<PageShellVariant, 'bleed'>, string> = {
    default: 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-8 sm:pb-14',
    narrow: 'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-8 sm:pb-14',
    workspace: 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-10 sm:pt-6 sm:pb-14',
}

export function PageShell({
    children,
    variant = 'default',
    className = '',
    innerClassName = '',
}: PageShellProps) {
    if (variant === 'bleed') {
        return (
            <div className={`flex-1 w-full ${className}`.trim()}>
                {innerClassName ? (
                    <div className={innerClassName}>{children}</div>
                ) : (
                    children
                )}
            </div>
        )
    }

    return (
        <div className={`flex-1 ${variantClasses[variant]} ${className}`.trim()}>
            {children}
        </div>
    )
}
