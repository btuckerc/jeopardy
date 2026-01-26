'use client'

import { ReactNode } from 'react'

interface MetricCardProps {
    title: string
    value: string | number
    subtitle?: string
    trend?: {
        value: number
        label: string
        isPositive?: boolean
    }
    icon?: ReactNode
    color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
}

const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
}

const valueColorClasses = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    red: 'text-red-900',
    yellow: 'text-yellow-900',
    purple: 'text-purple-900',
    gray: 'text-gray-900',
}

export function MetricCard({
    title,
    value,
    subtitle,
    trend,
    icon,
    color = 'gray',
    size = 'md',
    loading = false,
}: MetricCardProps) {
    const sizeClasses = {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
    }

    const valueSizeClasses = {
        sm: 'text-xl',
        md: 'text-2xl',
        lg: 'text-3xl',
    }

    if (loading) {
        return (
            <div className={`rounded-lg border-2 ${colorClasses[color]} ${sizeClasses[size]} animate-pulse`}>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
        )
    }

    return (
        <div className={`rounded-lg border-2 ${colorClasses[color]} ${sizeClasses[size]} transition-all hover:shadow-md`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium opacity-80">{title}</p>
                    <p className={`${valueSizeClasses[size]} font-bold ${valueColorClasses[color]}`}>
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    {subtitle && (
                        <p className="text-xs opacity-70 mt-0.5">{subtitle}</p>
                    )}
                    {trend && (
                        <p className={`text-xs mt-1 font-medium ${
                            trend.isPositive !== undefined
                                ? trend.isPositive
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                : 'text-gray-600'
                        }`}>
                            {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}% {trend.label}
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="opacity-60 ml-2">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    )
}

interface MetricGridProps {
    children: ReactNode
    columns?: 2 | 3 | 4 | 5 | 6
}

export function MetricGrid({ children, columns = 4 }: MetricGridProps) {
    const columnClasses = {
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
        6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
    }

    return (
        <div className={`grid ${columnClasses[columns]} gap-4`}>
            {children}
        </div>
    )
}

