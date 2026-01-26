'use client'

import { useState } from 'react'
import { MetricCard, MetricGrid } from '../MetricCard'
import { TimeSeriesChart, DonutChart, HorizontalBarChart } from '../Charts'
import { DataTable, StatusBadge, getStatusVariant } from '../DataTable'
import { useAbuseMetrics } from '../../hooks/useAdminQueries'

type TimeWindow = '7d' | '30d' | '90d'

interface WindowButtonProps {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}

function WindowButton({ active, onClick, children }: WindowButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`
                px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                ${active
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-blue-400'
                }
            `}
        >
            {children}
        </button>
    )
}

export function AbusePipelineTab() {
    const [window, setWindow] = useState<TimeWindow>('30d')

    const { data: abuse, isLoading } = useAbuseMetrics(window)

    // Transform data for charts
    const disputeModeData = abuse?.disputes.byMode.map(m => ({
        name: m.mode.replace(/_/g, ' '),
        value: m.count,
    })) ?? []

    const issueCategoryData = abuse?.issues.byCategory.map(c => ({
        name: c.category.replace(/_/g, ' '),
        value: c.count,
    })) ?? []

    return (
        <div className="space-y-8">
            {/* Time Window Selector */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Disputes & Issues Pipeline</h2>
                <div className="flex gap-2">
                    {(['7d', '30d', '90d'] as const).map(w => (
                        <WindowButton
                            key={w}
                            active={window === w}
                            onClick={() => setWindow(w)}
                        >
                            {w}
                        </WindowButton>
                    ))}
                </div>
            </div>

            {/* Combined Timeline */}
            <TimeSeriesChart
                title="Pipeline Activity"
                subtitle="Disputes and issues created/resolved over time"
                data={abuse?.timeSeries ?? []}
                lines={[
                    { key: 'disputesCreated', name: 'Disputes Created', color: '#ef4444' },
                    { key: 'disputesResolved', name: 'Disputes Resolved', color: '#10b981' },
                    { key: 'issuesCreated', name: 'Issues Created', color: '#f59e0b' },
                    { key: 'issuesResolved', name: 'Issues Resolved', color: '#3b82f6' },
                ]}
                loading={isLoading}
                height={280}
            />

            {/* Disputes Section */}
            <section>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Disputes</h3>
                
                {/* Dispute Summary Cards */}
                <MetricGrid columns={6}>
                    <MetricCard
                        title="Total (in window)"
                        value={abuse?.disputes.summary.totalInWindow ?? 0}
                        color="gray"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Pending"
                        value={abuse?.disputes.summary.pending ?? 0}
                        color={abuse?.disputes.summary.pending && abuse.disputes.summary.pending > 5 ? 'red' : 'yellow'}
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Approved"
                        value={abuse?.disputes.summary.approved ?? 0}
                        color="green"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Rejected"
                        value={abuse?.disputes.summary.rejected ?? 0}
                        color="gray"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="P50 Resolution"
                        value={`${abuse?.disputes.resolutionStats.p50Hours ?? 0}h`}
                        subtitle="median time"
                        color="blue"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="SLA (<24h)"
                        value={`${(abuse?.disputes.sla.pctWithin24h ?? 0).toFixed(0)}%`}
                        subtitle={`${abuse?.disputes.sla.within24h ?? 0}/${abuse?.disputes.sla.total ?? 0}`}
                        color={abuse?.disputes.sla.pctWithin24h && abuse.disputes.sla.pctWithin24h > 80 ? 'green' : 'yellow'}
                        loading={isLoading}
                    />
                </MetricGrid>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                    {/* By Mode */}
                    <DonutChart
                        title="Disputes by Mode"
                        data={disputeModeData}
                        loading={isLoading}
                        height={220}
                    />

                    {/* Aging Table */}
                    <div className="lg:col-span-2">
                        <DataTable
                            title="Pending Disputes (Oldest First)"
                            data={abuse?.disputes.aging ?? []}
                            keyField="id"
                            loading={isLoading}
                            compact
                            maxHeight="220px"
                            stickyHeader
                            columns={[
                                {
                                    key: 'ageDays',
                                    header: 'Age',
                                    width: '60px',
                                    render: (row) => (
                                        <span className={`
                                            font-bold
                                            ${row.ageDays >= 3 ? 'text-red-600' : 
                                              row.ageDays >= 1 ? 'text-yellow-600' : 'text-gray-600'}
                                        `}>
                                            {row.ageDays}d
                                        </span>
                                    ),
                                },
                                {
                                    key: 'mode',
                                    header: 'Mode',
                                    width: '100px',
                                    render: (row) => (
                                        <StatusBadge status={row.mode} variant="info" />
                                    ),
                                },
                                {
                                    key: 'user',
                                    header: 'User',
                                    render: (row) => (
                                        <span className="text-xs truncate">{row.user}</span>
                                    ),
                                },
                                {
                                    key: 'questionPreview',
                                    header: 'Question',
                                    render: (row) => (
                                        <span className="text-xs text-gray-600 truncate">{row.questionPreview}</span>
                                    ),
                                },
                            ]}
                        />
                    </div>
                </div>
            </section>

            {/* Issues Section */}
            <section>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Issues</h3>
                
                {/* Issue Summary Cards */}
                <MetricGrid columns={6}>
                    <MetricCard
                        title="Total (in window)"
                        value={abuse?.issues.summary.totalInWindow ?? 0}
                        color="gray"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Open"
                        value={abuse?.issues.summary.open ?? 0}
                        color={abuse?.issues.summary.open && abuse.issues.summary.open > 5 ? 'red' : 'yellow'}
                        loading={isLoading}
                    />
                    <MetricCard
                        title="In Progress"
                        value={abuse?.issues.summary.inProgress ?? 0}
                        color="blue"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Resolved"
                        value={abuse?.issues.summary.resolved ?? 0}
                        color="green"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="P50 Resolution"
                        value={`${abuse?.issues.resolutionStats.p50Hours ?? 0}h`}
                        subtitle="median time"
                        color="blue"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="SLA (<48h)"
                        value={`${(abuse?.issues.sla.pctWithin48h ?? 0).toFixed(0)}%`}
                        subtitle={`${abuse?.issues.sla.within48h ?? 0}/${abuse?.issues.sla.total ?? 0}`}
                        color={abuse?.issues.sla.pctWithin48h && abuse.issues.sla.pctWithin48h > 80 ? 'green' : 'yellow'}
                        loading={isLoading}
                    />
                </MetricGrid>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                    {/* By Category */}
                    <HorizontalBarChart
                        title="Issues by Category"
                        data={issueCategoryData}
                        loading={isLoading}
                        height={220}
                        color="#f59e0b"
                    />

                    {/* Aging Table */}
                    <div className="lg:col-span-2">
                        <DataTable
                            title="Open Issues (Oldest First)"
                            data={abuse?.issues.aging ?? []}
                            keyField="id"
                            loading={isLoading}
                            compact
                            maxHeight="220px"
                            stickyHeader
                            columns={[
                                {
                                    key: 'ageDays',
                                    header: 'Age',
                                    width: '60px',
                                    render: (row) => (
                                        <span className={`
                                            font-bold
                                            ${row.ageDays >= 7 ? 'text-red-600' : 
                                              row.ageDays >= 3 ? 'text-yellow-600' : 'text-gray-600'}
                                        `}>
                                            {row.ageDays}d
                                        </span>
                                    ),
                                },
                                {
                                    key: 'status',
                                    header: 'Status',
                                    width: '100px',
                                    render: (row) => (
                                        <StatusBadge
                                            status={row.status}
                                            variant={getStatusVariant(row.status)}
                                        />
                                    ),
                                },
                                {
                                    key: 'category',
                                    header: 'Category',
                                    width: '100px',
                                    render: (row) => (
                                        <span className="text-xs">{row.category}</span>
                                    ),
                                },
                                {
                                    key: 'subject',
                                    header: 'Subject',
                                    render: (row) => (
                                        <span className="text-xs truncate">{row.subject}</span>
                                    ),
                                },
                                {
                                    key: 'user',
                                    header: 'User',
                                    render: (row) => (
                                        <span className="text-xs text-gray-600">{row.user}</span>
                                    ),
                                },
                            ]}
                        />
                    </div>
                </div>
            </section>

            {/* SLA Summary */}
            <section>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Resolution SLA Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Disputes SLA */}
                    <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Disputes Resolution Time</h4>
                        <div className="space-y-3">
                            {[
                                { label: 'Within 24h', value: abuse?.disputes.sla.within24h ?? 0, pct: abuse?.disputes.sla.pctWithin24h ?? 0 },
                                { label: 'Within 48h', value: abuse?.disputes.sla.within48h ?? 0, pct: abuse?.disputes.sla.pctWithin48h ?? 0 },
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">{item.label}</span>
                                        <span className="font-medium">{item.value} ({item.pct.toFixed(0)}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${item.pct >= 80 ? 'bg-green-500' : item.pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${Math.min(100, item.pct)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                                <p>P50: {abuse?.disputes.resolutionStats.p50Hours ?? 0}h | P95: {abuse?.disputes.resolutionStats.p95Hours ?? 0}h | Avg: {abuse?.disputes.resolutionStats.avgHours ?? 0}h</p>
                            </div>
                        </div>
                    </div>

                    {/* Issues SLA */}
                    <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Issues Resolution Time</h4>
                        <div className="space-y-3">
                            {[
                                { label: 'Within 24h', value: abuse?.issues.sla.within24h ?? 0, pct: abuse?.issues.sla.pctWithin24h ?? 0 },
                                { label: 'Within 48h', value: abuse?.issues.sla.within48h ?? 0, pct: abuse?.issues.sla.pctWithin48h ?? 0 },
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">{item.label}</span>
                                        <span className="font-medium">{item.value} ({item.pct.toFixed(0)}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${item.pct >= 80 ? 'bg-green-500' : item.pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${Math.min(100, item.pct)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="pt-2 border-t border-gray-200 text-xs text-gray-500">
                                <p>P50: {abuse?.issues.resolutionStats.p50Hours ?? 0}h | P95: {abuse?.issues.resolutionStats.p95Hours ?? 0}h | Avg: {abuse?.issues.resolutionStats.avgHours ?? 0}h</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

