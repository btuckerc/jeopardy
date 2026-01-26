'use client'

import { useState } from 'react'
import { MetricCard, MetricGrid } from '../MetricCard'
import { TimeSeriesChart } from '../Charts'
import { DataTable } from '../DataTable'
import { useApiMetrics, useDbMetrics } from '../../hooks/useAdminQueries'

type TimeWindow = '1h' | '24h' | '7d' | '30d'

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

export function ObservabilityTab() {
    const [apiWindow, setApiWindow] = useState<TimeWindow>('24h')
    const [dbWindow, setDbWindow] = useState<TimeWindow>('24h')
    const [selectedModel, setSelectedModel] = useState<string | undefined>()

    const { data: apiMetrics, isLoading: apiLoading } = useApiMetrics(apiWindow)
    const { data: dbMetrics, isLoading: dbLoading } = useDbMetrics(dbWindow, selectedModel)

    return (
        <div className="space-y-8">
            {/* API Performance Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">API Performance</h2>
                    <div className="flex gap-2">
                        {(['1h', '24h', '7d', '30d'] as const).map(w => (
                            <WindowButton
                                key={w}
                                active={apiWindow === w}
                                onClick={() => setApiWindow(w)}
                            >
                                {w}
                            </WindowButton>
                        ))}
                    </div>
                </div>

                {/* API Summary Cards */}
                <MetricGrid columns={5}>
                    <MetricCard
                        title="Total Requests"
                        value={apiMetrics?.totals.requests ?? 0}
                        subtitle={`in ${apiWindow}`}
                        color="blue"
                        loading={apiLoading}
                    />
                    <MetricCard
                        title="Error Rate"
                        value={`${(apiMetrics?.totals.errorRate ?? 0).toFixed(1)}%`}
                        subtitle={`${apiMetrics?.totals.errors ?? 0} errors`}
                        color={apiMetrics?.totals.errorRate && apiMetrics.totals.errorRate > 5 ? 'red' : 'green'}
                        loading={apiLoading}
                    />
                    <MetricCard
                        title="P50 Latency"
                        value={`${apiMetrics?.totals.p50 ?? 0}ms`}
                        subtitle="median"
                        color="gray"
                        loading={apiLoading}
                    />
                    <MetricCard
                        title="P95 Latency"
                        value={`${apiMetrics?.totals.p95 ?? 0}ms`}
                        subtitle="95th percentile"
                        color={apiMetrics?.totals.p95 && apiMetrics.totals.p95 > 500 ? 'yellow' : 'gray'}
                        loading={apiLoading}
                    />
                    <MetricCard
                        title="P99 Latency"
                        value={`${apiMetrics?.totals.p99 ?? 0}ms`}
                        subtitle="99th percentile"
                        color={apiMetrics?.totals.p99 && apiMetrics.totals.p99 > 1000 ? 'red' : 'gray'}
                        loading={apiLoading}
                    />
                </MetricGrid>

                {/* API Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <TimeSeriesChart
                        title="Request Volume & Errors"
                        subtitle="Requests and error count over time"
                        data={apiMetrics?.timeSeries ?? []}
                        lines={[
                            { key: 'requests', name: 'Requests', color: '#3b82f6' },
                            { key: 'errors', name: 'Errors', color: '#ef4444' },
                        ]}
                        loading={apiLoading}
                        height={250}
                    />
                    <TimeSeriesChart
                        title="Response Latency"
                        subtitle="P50, P95, and P99 latency in ms"
                        data={apiMetrics?.timeSeries ?? []}
                        lines={[
                            { key: 'p50', name: 'P50', color: '#10b981' },
                            { key: 'p95', name: 'P95', color: '#f59e0b' },
                            { key: 'p99', name: 'P99', color: '#ef4444' },
                        ]}
                        loading={apiLoading}
                        height={250}
                        yAxisLabel="ms"
                    />
                </div>

                {/* Top Routes Table */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <DataTable
                        title="Top Routes by Volume"
                        data={apiMetrics?.topRoutes ?? []}
                        keyField="route"
                        loading={apiLoading}
                        compact
                        maxHeight="300px"
                        stickyHeader
                        columns={[
                            {
                                key: 'route',
                                header: 'Route',
                                render: (row) => (
                                    <span className="font-mono text-xs">{row.route}</span>
                                ),
                            },
                            {
                                key: 'requests',
                                header: 'Requests',
                                align: 'right',
                                sortable: true,
                            },
                            {
                                key: 'errorRate',
                                header: 'Errors',
                                align: 'right',
                                render: (row) => (
                                    <span className={row.errorRate > 5 ? 'text-red-600 font-medium' : ''}>
                                        {row.errorRate.toFixed(1)}%
                                    </span>
                                ),
                            },
                            {
                                key: 'p95',
                                header: 'P95',
                                align: 'right',
                                render: (row) => `${row.p95}ms`,
                            },
                        ]}
                    />
                    <DataTable
                        title="Slowest Routes"
                        data={apiMetrics?.slowestRoutes ?? []}
                        keyField="route"
                        loading={apiLoading}
                        compact
                        maxHeight="300px"
                        stickyHeader
                        columns={[
                            {
                                key: 'route',
                                header: 'Route',
                                render: (row) => (
                                    <span className="font-mono text-xs">{row.route}</span>
                                ),
                            },
                            {
                                key: 'p95',
                                header: 'P95',
                                align: 'right',
                                sortable: true,
                                render: (row) => (
                                    <span className={row.p95 > 500 ? 'text-red-600 font-medium' : ''}>
                                        {row.p95}ms
                                    </span>
                                ),
                            },
                            {
                                key: 'maxDuration',
                                header: 'Max',
                                align: 'right',
                                render: (row) => `${row.maxDuration}ms`,
                            },
                            {
                                key: 'requests',
                                header: 'Count',
                                align: 'right',
                            },
                        ]}
                    />
                </div>
            </section>

            {/* Database Performance Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Database Performance</h2>
                    <div className="flex gap-4 items-center">
                        {dbMetrics?.availableModels && dbMetrics.availableModels.length > 0 && (
                            <select
                                value={selectedModel || ''}
                                onChange={(e) => setSelectedModel(e.target.value || undefined)}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-900"
                            >
                                <option value="">All Models</option>
                                {dbMetrics.availableModels.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                            </select>
                        )}
                        <div className="flex gap-2">
                            {(['1h', '24h', '7d', '30d'] as const).map(w => (
                                <WindowButton
                                    key={w}
                                    active={dbWindow === w}
                                    onClick={() => setDbWindow(w)}
                                >
                                    {w}
                                </WindowButton>
                            ))}
                        </div>
                    </div>
                </div>

                {/* DB Summary Cards */}
                <MetricGrid columns={5}>
                    <MetricCard
                        title="Total Queries"
                        value={dbMetrics?.totals.queries ?? 0}
                        subtitle={`in ${dbWindow}`}
                        color="blue"
                        loading={dbLoading}
                    />
                    <MetricCard
                        title="Slow Queries"
                        value={dbMetrics?.totals.slowQueries ?? 0}
                        subtitle={`${(dbMetrics?.totals.slowRate ?? 0).toFixed(1)}% of total`}
                        color={dbMetrics?.totals.slowRate && dbMetrics.totals.slowRate > 10 ? 'red' : 'yellow'}
                        loading={dbLoading}
                    />
                    <MetricCard
                        title="Error Rate"
                        value={`${(dbMetrics?.totals.errorRate ?? 0).toFixed(2)}%`}
                        subtitle={`${dbMetrics?.totals.errors ?? 0} errors`}
                        color={dbMetrics?.totals.errorRate && dbMetrics.totals.errorRate > 1 ? 'red' : 'green'}
                        loading={dbLoading}
                    />
                    <MetricCard
                        title="P50 Duration"
                        value={`${dbMetrics?.totals.p50 ?? 0}ms`}
                        subtitle="median"
                        color="gray"
                        loading={dbLoading}
                    />
                    <MetricCard
                        title="P95 Duration"
                        value={`${dbMetrics?.totals.p95 ?? 0}ms`}
                        subtitle="95th percentile"
                        color={dbMetrics?.totals.p95 && dbMetrics.totals.p95 > 100 ? 'yellow' : 'gray'}
                        loading={dbLoading}
                    />
                </MetricGrid>

                {/* DB Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <TimeSeriesChart
                        title="Query Volume"
                        subtitle="Total queries and slow queries over time"
                        data={dbMetrics?.timeSeries ?? []}
                        lines={[
                            { key: 'queries', name: 'Queries', color: '#3b82f6' },
                            { key: 'slowQueries', name: 'Slow Queries', color: '#f59e0b' },
                        ]}
                        loading={dbLoading}
                        height={250}
                    />
                    <TimeSeriesChart
                        title="Query Duration"
                        subtitle="P50 and P95 query duration in ms"
                        data={dbMetrics?.timeSeries ?? []}
                        lines={[
                            { key: 'p50', name: 'P50', color: '#10b981' },
                            { key: 'p95', name: 'P95', color: '#f59e0b' },
                        ]}
                        loading={dbLoading}
                        height={250}
                        yAxisLabel="ms"
                    />
                </div>

                {/* DB Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <DataTable
                        title="Top Operations by Volume"
                        data={dbMetrics?.topOperations ?? []}
                        keyField="model"
                        loading={dbLoading}
                        compact
                        maxHeight="300px"
                        stickyHeader
                        columns={[
                            {
                                key: 'model',
                                header: 'Model',
                                render: (row) => (
                                    <span className="font-mono text-xs">{row.model}</span>
                                ),
                            },
                            {
                                key: 'action',
                                header: 'Action',
                                render: (row) => (
                                    <span className="font-mono text-xs text-gray-600">{row.action}</span>
                                ),
                            },
                            {
                                key: 'queries',
                                header: 'Queries',
                                align: 'right',
                                sortable: true,
                            },
                            {
                                key: 'p95',
                                header: 'P95',
                                align: 'right',
                                render: (row) => `${row.p95}ms`,
                            },
                        ]}
                    />
                    <DataTable
                        title="Recent Slow Queries"
                        data={dbMetrics?.recentSlowQueries ?? []}
                        keyField="id"
                        loading={dbLoading}
                        compact
                        maxHeight="300px"
                        stickyHeader
                        columns={[
                            {
                                key: 'timestamp',
                                header: 'Time',
                                render: (row) => new Date(row.timestamp).toLocaleTimeString(),
                            },
                            {
                                key: 'model',
                                header: 'Model',
                                render: (row) => (
                                    <span className="font-mono text-xs">{row.model}</span>
                                ),
                            },
                            {
                                key: 'action',
                                header: 'Action',
                                render: (row) => (
                                    <span className="font-mono text-xs text-gray-600">{row.action}</span>
                                ),
                            },
                            {
                                key: 'durationMs',
                                header: 'Duration',
                                align: 'right',
                                render: (row) => (
                                    <span className="text-red-600 font-medium">{row.durationMs}ms</span>
                                ),
                            },
                        ]}
                    />
                </div>
            </section>
        </div>
    )
}

