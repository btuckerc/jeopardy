'use client'

import { useState } from 'react'
import { usePerfMetrics, type RouteStats, type RouteMetric } from '../../hooks/useAdminQueries'
import { MetricCard, MetricGrid } from '../MetricCard'

function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
}

function StatusBadge({ statusCode }: { statusCode: number }) {
    const color = statusCode < 300 ? 'green' : statusCode < 400 ? 'yellow' : statusCode < 500 ? 'orange' : 'red'
    const bgColors = {
        green: 'bg-green-100 text-green-800',
        yellow: 'bg-yellow-100 text-yellow-800',
        orange: 'bg-orange-100 text-orange-800',
        red: 'bg-red-100 text-red-800',
    }
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${bgColors[color]}`}>
            {statusCode}
        </span>
    )
}

function MethodBadge({ method }: { method: string }) {
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            method === 'GET' ? 'bg-blue-100 text-blue-800' :
            method === 'POST' ? 'bg-green-100 text-green-800' :
            method === 'DELETE' ? 'bg-red-100 text-red-800' :
            method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
        }`}>
            {method}
        </span>
    )
}

function RouteStatsRow({ stats }: { stats: RouteStats }) {
    const [expanded, setExpanded] = useState(false)
    
    return (
        <div className="border-b border-gray-100 last:border-0">
            <div 
                className="flex items-center gap-4 p-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <MethodBadge method={stats.method} />
                        <span className="font-mono text-sm truncate text-gray-900">{stats.route}</span>
                    </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                    <div className="text-right w-16">
                        <div className="font-medium text-gray-900">{stats.count}</div>
                        <div className="text-xs text-gray-500">requests</div>
                    </div>
                    <div className="text-right w-16">
                        <div className={`font-medium ${stats.avgMs > 500 ? 'text-red-600' : stats.avgMs > 200 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {formatMs(stats.avgMs)}
                        </div>
                        <div className="text-xs text-gray-500">avg</div>
                    </div>
                    <div className="text-right w-16">
                        <div className={`font-medium ${stats.p95Ms > 1000 ? 'text-red-600' : stats.p95Ms > 500 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {formatMs(stats.p95Ms)}
                        </div>
                        <div className="text-xs text-gray-500">p95</div>
                    </div>
                    <div className="text-right w-16">
                        <div className={`font-medium ${stats.errorRate > 5 ? 'text-red-600' : stats.errorRate > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {stats.errorRate}%
                        </div>
                        <div className="text-xs text-gray-500">errors</div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
            
            {expanded && stats.recentRequests.length > 0 && (
                <div className="bg-gray-50 p-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-2">Recent Requests</div>
                    <div className="space-y-1">
                        {stats.recentRequests.slice(0, 5).map((req, i) => (
                            <div key={i} className="flex items-center gap-4 text-xs">
                                <StatusBadge statusCode={req.statusCode} />
                                <span className={`font-mono ${req.durationMs > 500 ? 'text-red-600' : req.durationMs > 200 ? 'text-yellow-600' : 'text-gray-600'}`}>
                                    {formatMs(req.durationMs)}
                                </span>
                                <span className="text-gray-400">
                                    {new Date(req.timestamp).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                        <div><span className="text-gray-500">Min:</span> <span className="font-mono">{formatMs(stats.minMs)}</span></div>
                        <div><span className="text-gray-500">Max:</span> <span className="font-mono">{formatMs(stats.maxMs)}</span></div>
                        <div><span className="text-gray-500">p50:</span> <span className="font-mono">{formatMs(stats.p50Ms)}</span></div>
                        <div><span className="text-gray-500">p99:</span> <span className="font-mono">{formatMs(stats.p99Ms)}</span></div>
                    </div>
                </div>
            )}
        </div>
    )
}

function SlowRequestRow({ metric }: { metric: RouteMetric }) {
    return (
        <div className="flex items-center gap-4 p-2 text-sm hover:bg-gray-50">
            <MethodBadge method={metric.method} />
            <span className="font-mono text-xs truncate flex-1 text-gray-900">{metric.route}</span>
            <StatusBadge statusCode={metric.statusCode} />
            <span className={`font-mono text-xs font-medium ${metric.durationMs > 1000 ? 'text-red-600' : 'text-yellow-600'}`}>
                {formatMs(metric.durationMs)}
            </span>
            <span className="text-xs text-gray-400 w-32 text-right">
                {new Date(metric.timestamp).toLocaleString()}
            </span>
        </div>
    )
}

function ErrorRow({ metric }: { metric: RouteMetric }) {
    return (
        <div className="flex items-center gap-4 p-2 text-sm hover:bg-gray-50">
            <MethodBadge method={metric.method} />
            <span className="font-mono text-xs truncate flex-1 text-gray-900">{metric.route}</span>
            <StatusBadge statusCode={metric.statusCode} />
            {metric.errorCode && (
                <span className="text-xs text-red-600 font-mono">{metric.errorCode}</span>
            )}
            <span className="text-xs text-gray-400 w-32 text-right">
                {new Date(metric.timestamp).toLocaleString()}
            </span>
        </div>
    )
}

const TIME_WINDOWS = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
]

export function PerformanceTab() {
    const [window, setWindow] = useState('24h')
    const { data: perfMetrics, isLoading, error, refetch } = usePerfMetrics(window)
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }
    
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                Error loading performance metrics: {error.message}
            </div>
        )
    }
    
    if (!perfMetrics) {
        return (
            <div className="text-gray-500 text-center py-8">
                No performance data available yet. Metrics are recorded for API requests using the instrumentation wrapper.
            </div>
        )
    }
    
    return (
        <div className="space-y-6">
            {/* Header with time window selector and refresh */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">API Performance</h2>
                    <p className="text-sm text-gray-500">
                        Monitoring API response times and errors from the database
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        {TIME_WINDOWS.map(tw => (
                            <button
                                key={tw.value}
                                onClick={() => setWindow(tw.value)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    window === tw.value 
                                        ? 'bg-white text-gray-900 shadow-sm' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {tw.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>
            
            {/* Sampling notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Sampling:</strong> 100% of errors (4xx/5xx), 100% of slow requests (&gt;200ms), 10% of fast requests are logged.
            </div>
            
            {/* Overview Cards */}
            <MetricGrid columns={4}>
                <MetricCard
                    title="Total Requests"
                    value={perfMetrics.totalRequests.toLocaleString()}
                    subtitle={`in ${TIME_WINDOWS.find(t => t.value === window)?.label}`}
                    color="blue"
                />
                <MetricCard
                    title="Avg Response Time"
                    value={formatMs(perfMetrics.avgResponseTime)}
                    subtitle="across all routes"
                    color={perfMetrics.avgResponseTime > 500 ? 'red' : perfMetrics.avgResponseTime > 200 ? 'yellow' : 'green'}
                />
                <MetricCard
                    title="Error Rate"
                    value={`${perfMetrics.errorRate}%`}
                    subtitle="4xx/5xx responses"
                    color={perfMetrics.errorRate > 5 ? 'red' : perfMetrics.errorRate > 0 ? 'yellow' : 'green'}
                />
                <MetricCard
                    title="Routes Tracked"
                    value={perfMetrics.routeStats.length.toString()}
                    subtitle="unique endpoints"
                    color="gray"
                />
            </MetricGrid>
            
            {/* Slowest Routes */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
                    <h3 className="font-medium text-yellow-900">Slowest Routes (by p95)</h3>
                    <p className="text-xs text-yellow-700 mt-0.5">Routes with at least 3 requests, sorted by 95th percentile latency</p>
                </div>
                <div className="divide-y divide-gray-100">
                    {perfMetrics.slowestRoutes.length === 0 ? (
                        <div className="p-4 text-gray-500 text-center text-sm">No slow routes detected</div>
                    ) : (
                        perfMetrics.slowestRoutes.map((stats, i) => (
                            <RouteStatsRow key={`${stats.method}-${stats.route}-${i}`} stats={stats} />
                        ))
                    )}
                </div>
            </div>
            
            {/* Recent Slow Requests */}
            {perfMetrics.recentSlowRequests.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                        <h3 className="font-medium text-orange-900">Recent Slow Requests (&gt;200ms)</h3>
                        <p className="text-xs text-orange-700 mt-0.5">Individual requests that exceeded the slow threshold</p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                        {perfMetrics.recentSlowRequests.map((metric, i) => (
                            <SlowRequestRow key={`slow-${i}`} metric={metric} />
                        ))}
                    </div>
                </div>
            )}
            
            {/* Recent Errors */}
            {perfMetrics.recentErrors && perfMetrics.recentErrors.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                        <h3 className="font-medium text-red-900">Recent Errors</h3>
                        <p className="text-xs text-red-700 mt-0.5">4xx and 5xx responses</p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                        {perfMetrics.recentErrors.map((metric, i) => (
                            <ErrorRow key={`error-${i}`} metric={metric} />
                        ))}
                    </div>
                </div>
            )}
            
            {/* Most Frequent Routes */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900">Most Frequent Routes</h3>
                    <p className="text-xs text-gray-600 mt-0.5">Routes with the highest request volume</p>
                </div>
                <div className="divide-y divide-gray-100">
                    {perfMetrics.mostFrequentRoutes.length === 0 ? (
                        <div className="p-4 text-gray-500 text-center text-sm">No data yet</div>
                    ) : (
                        perfMetrics.mostFrequentRoutes.map((stats, i) => (
                            <RouteStatsRow key={`freq-${stats.method}-${stats.route}-${i}`} stats={stats} />
                        ))
                    )}
                </div>
            </div>
            
            {/* All Routes Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900">All Routes (by recent activity)</h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {perfMetrics.routeStats.length === 0 ? (
                        <div className="p-4 text-gray-500 text-center text-sm">No data yet</div>
                    ) : (
                        perfMetrics.routeStats.map((stats, i) => (
                            <RouteStatsRow key={`all-${stats.method}-${stats.route}-${i}`} stats={stats} />
                        ))
                    )}
                </div>
            </div>
            
            {/* Timestamp */}
            <div className="text-xs text-gray-400 text-center">
                Data from: {new Date(perfMetrics.timestamp).toLocaleString()} • Window: {TIME_WINDOWS.find(t => t.value === window)?.label}
            </div>
        </div>
    )
}
