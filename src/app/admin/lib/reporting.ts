export type AdminReportingWindow = '24h' | '7d' | '14d' | '30d' | 'all'

export const ADMIN_REPORTING_WINDOWS: Array<{
    value: AdminReportingWindow
    label: string
}> = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '14d', label: '14d' },
    { value: '30d', label: '30d' },
    { value: 'all', label: 'All time' },
]

export function getAdminReportingWindowLabel(window: AdminReportingWindow): string {
    return ADMIN_REPORTING_WINDOWS.find(option => option.value === window)?.label || window
}
