'use client'

import { ReactNode, useState } from 'react'

interface Column<T> {
    key: string
    header: string
    width?: string
    align?: 'left' | 'center' | 'right'
    render?: (row: T) => ReactNode
    sortable?: boolean
}

interface DataTableProps<T> {
    data: T[]
    columns: Column<T>[]
    keyField: string
    title?: string
    loading?: boolean
    emptyMessage?: string
    compact?: boolean
    stickyHeader?: boolean
    maxHeight?: string
    onRowClick?: (row: T) => void
    pagination?: {
        page: number
        pageSize: number
        total: number
        onPageChange: (page: number) => void
    }
    actions?: ReactNode
}

export function DataTable<T extends Record<string, unknown>>({
    data,
    columns,
    keyField,
    title,
    loading = false,
    emptyMessage = 'No data available',
    compact = false,
    stickyHeader = false,
    maxHeight,
    onRowClick,
    pagination,
    actions,
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDirection('asc')
        }
    }

    // Sort data if sortKey is set
    const sortedData = sortKey
        ? [...data].sort((a, b) => {
            const aVal = a[sortKey]
            const bVal = b[sortKey]
            if (aVal === bVal) return 0
            if (aVal === null || aVal === undefined) return 1
            if (bVal === null || bVal === undefined) return -1
            const comparison = aVal < bVal ? -1 : 1
            return sortDirection === 'asc' ? comparison : -comparison
        })
        : data

    const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3'
    const fontSize = compact ? 'text-xs' : 'text-sm'

    const totalPages = pagination 
        ? Math.ceil(pagination.total / pagination.pageSize) 
        : 1

    return (
        <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
            {(title || actions) && (
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    {title && (
                        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                    )}
                    {actions && <div className="flex gap-2">{actions}</div>}
                </div>
            )}

            <div 
                className={`overflow-auto ${stickyHeader ? 'relative' : ''}`}
                style={maxHeight ? { maxHeight } : undefined}
            >
                <table className="w-full">
                    <thead className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className={`
                                        ${cellPadding} ${fontSize}
                                        text-${col.align || 'left'}
                                        font-semibold text-gray-700
                                        border-b border-gray-200
                                        ${col.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}
                                    `}
                                    style={col.width ? { width: col.width } : undefined}
                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        {col.header}
                                        {col.sortable && sortKey === col.key && (
                                            <span className="text-gray-400">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {columns.map(col => (
                                        <td key={col.key} className={cellPadding}>
                                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td 
                                    colSpan={columns.length} 
                                    className={`${cellPadding} text-center text-gray-500 ${fontSize}`}
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            sortedData.map(row => (
                                <tr
                                    key={String(row[keyField])}
                                    className={`
                                        hover:bg-gray-50 transition-colors
                                        ${onRowClick ? 'cursor-pointer' : ''}
                                    `}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                >
                                    {columns.map(col => (
                                        <td
                                            key={col.key}
                                            className={`
                                                ${cellPadding} ${fontSize}
                                                text-${col.align || 'left'}
                                                text-gray-900
                                            `}
                                        >
                                            {col.render 
                                                ? col.render(row)
                                                : String(row[col.key] ?? '-')
                                            }
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {pagination && totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-xs text-gray-600">
                        Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                        {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                        {pagination.total} results
                    </p>
                    <div className="flex gap-1">
                        <button
                            onClick={() => pagination.onPageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                            let pageNum: number
                            if (totalPages <= 5) {
                                pageNum = i + 1
                            } else if (pagination.page <= 3) {
                                pageNum = i + 1
                            } else if (pagination.page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i
                            } else {
                                pageNum = pagination.page - 2 + i
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => pagination.onPageChange(pageNum)}
                                    className={`
                                        px-3 py-1 text-xs rounded border
                                        ${pagination.page === pageNum
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'border-gray-300 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    {pageNum}
                                </button>
                            )
                        })}
                        <button
                            onClick={() => pagination.onPageChange(pagination.page + 1)}
                            disabled={pagination.page >= totalPages}
                            className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// Status badge component for tables
interface StatusBadgeProps {
    status: string
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

const statusVariants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
}

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
    return (
        <span className={`
            inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
            ${statusVariants[variant]}
        `}>
            {status}
        </span>
    )
}

// Helper to get status badge variant from common status strings
export function getStatusVariant(status: string): StatusBadgeProps['variant'] {
    const statusLower = status.toLowerCase()
    if (['success', 'completed', 'approved', 'resolved', 'healthy'].includes(statusLower)) {
        return 'success'
    }
    if (['pending', 'in_progress', 'running', 'processing'].includes(statusLower)) {
        return 'warning'
    }
    if (['failed', 'error', 'rejected', 'unhealthy', 'abandoned'].includes(statusLower)) {
        return 'danger'
    }
    if (['open', 'new', 'info'].includes(statusLower)) {
        return 'info'
    }
    return 'default'
}

