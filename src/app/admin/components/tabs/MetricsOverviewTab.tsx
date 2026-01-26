'use client'

import { useState } from 'react'
import { MetricCard, MetricGrid } from '../MetricCard'
import { TimeSeriesChart, StackedAreaChart } from '../Charts'
import { DataTable, StatusBadge, getStatusVariant } from '../DataTable'
import { useUsageMetrics, useOpsMetrics, useGuestStats } from '../../hooks/useAdminQueries'

type TimeWindow = '24h' | '7d' | '14d' | '30d'

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

export function MetricsOverviewTab() {
    const [window, setWindow] = useState<TimeWindow>('7d')

    const { data: usageMetrics, isLoading: usageLoading } = useUsageMetrics(window)
    const { data: opsMetrics, isLoading: opsLoading } = useOpsMetrics(window === '14d' || window === '30d' ? '24h' : window)
    const { data: guestStats, isLoading: guestLoading } = useGuestStats()

    // Transform usage time series for charts
    const usageTimeSeries = usageMetrics?.timeSeries?.map(t => ({
        ...t,
        timestamp: t.timestamp,
    })) ?? []

    // Health status indicator
    const healthColor = {
        healthy: 'green',
        degraded: 'yellow',
        unhealthy: 'red',
        running: 'blue',
    } as const

    return (
        <div className="space-y-8">
            {/* Time Window Selector */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">System Overview</h2>
                <div className="flex gap-2">
                    {(['24h', '7d', '14d', '30d'] as const).map(w => (
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

            {/* Users & Activity Section */}
            <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Users</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <MetricCard
                        title="Total Users"
                        value={usageMetrics?.userbase?.totalUsers ?? 0}
                        color="blue"
                        loading={usageLoading}
                    />
                    <MetricCard
                        title="Active (24h)"
                        value={usageMetrics?.activity?.activeLastDay ?? 0}
                        color="green"
                        loading={usageLoading}
                    />
                    <MetricCard
                        title="Active (7d)"
                        value={usageMetrics?.activity?.activeLastWeek ?? 0}
                        color="blue"
                        loading={usageLoading}
                    />
                    <MetricCard
                        title="Active (30d)"
                        value={usageMetrics?.activity?.activeLastMonth ?? 0}
                        subtitle={`${usageMetrics?.activity?.dormant ?? 0} dormant`}
                        color="gray"
                        loading={usageLoading}
                    />
                </div>
                
                {/* Onboarding Funnel */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Onboarding Funnel</h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{usageMetrics?.onboarding?.profileCompleted ?? 0}%</div>
                            <div className="text-xs text-gray-500">Set Display Name</div>
                            <div className="text-xs text-gray-400">{usageMetrics?.onboarding?.withDisplayName ?? 0} users</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{usageMetrics?.onboarding?.playedGame ?? 0}%</div>
                            <div className="text-xs text-gray-500">Played a Game</div>
                            <div className="text-xs text-gray-400">{usageMetrics?.onboarding?.withGames ?? 0} users</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{usageMetrics?.onboarding?.triedDaily ?? 0}%</div>
                            <div className="text-xs text-gray-500">Tried Daily Challenge</div>
                            <div className="text-xs text-gray-400">{usageMetrics?.onboarding?.withDailyChallenges ?? 0} users</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{usageMetrics?.onboarding?.earnedAchievement ?? 0}%</div>
                            <div className="text-xs text-gray-500">Earned Achievement</div>
                            <div className="text-xs text-gray-400">{usageMetrics?.onboarding?.withAchievements ?? 0} users</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* System Health Summary */}
            <MetricGrid columns={5}>
                <MetricCard
                    title="System Health"
                    value={opsMetrics?.overallHealth?.toUpperCase() ?? 'LOADING'}
                    color={healthColor[opsMetrics?.overallHealth || 'healthy']}
                    loading={opsLoading}
                />
                <MetricCard
                    title="New Users"
                    value={usageMetrics?.userbase?.newUsersInWindow ?? 0}
                    subtitle={`in ${window}`}
                    color="green"
                    loading={usageLoading}
                />
                <MetricCard
                    title="Guest Sessions"
                    value={guestStats?.totalSessions ?? 0}
                    subtitle={`${guestStats?.claimedSessions ?? 0} claimed`}
                    color="purple"
                    loading={guestLoading}
                />
                <MetricCard
                    title="Conversion Rate"
                    value={`${(usageMetrics?.conversionRate ?? 0).toFixed(1)}%`}
                    subtitle="guest to user"
                    color={usageMetrics?.conversionRate && usageMetrics.conversionRate > 10 ? 'green' : 'yellow'}
                    loading={usageLoading}
                />
                <MetricCard
                    title="Pending Disputes"
                    value={opsMetrics?.disputes?.pending ?? 0}
                    subtitle={`${opsMetrics?.disputes?.recent24h ?? 0} new today`}
                    color={opsMetrics?.disputes?.pending && opsMetrics.disputes.pending > 5 ? 'red' : 'gray'}
                    loading={opsLoading}
                />
            </MetricGrid>

            {/* Usage Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TimeSeriesChart
                    title="User Activity"
                    subtitle="New and active users over time"
                    data={usageTimeSeries}
                    lines={[
                        { key: 'newUsers', name: 'New Users', color: '#10b981' },
                        { key: 'activeUsers', name: 'Active Users', color: '#3b82f6' },
                    ]}
                    loading={usageLoading}
                    height={280}
                />
                <TimeSeriesChart
                    title="Games & Challenges"
                    subtitle="Games started, completed, and daily challenges"
                    data={usageTimeSeries}
                    lines={[
                        { key: 'gamesStarted', name: 'Games Started', color: '#3b82f6' },
                        { key: 'gamesCompleted', name: 'Games Completed', color: '#10b981' },
                        { key: 'dailyChallengeSubmissions', name: 'Daily Challenges', color: '#8b5cf6' },
                    ]}
                    loading={usageLoading}
                    height={280}
                />
            </div>

            {/* Guest Activity Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TimeSeriesChart
                    title="Guest Sessions"
                    subtitle="Sessions created and claimed"
                    data={usageTimeSeries}
                    lines={[
                        { key: 'guestSessionsCreated', name: 'Created', color: '#6b7280' },
                        { key: 'guestSessionsClaimed', name: 'Claimed', color: '#10b981' },
                    ]}
                    loading={usageLoading}
                    height={250}
                />
                <TimeSeriesChart
                    title="Guest Games"
                    subtitle="Guest games and questions answered"
                    data={usageTimeSeries}
                    lines={[
                        { key: 'guestGamesStarted', name: 'Guest Games', color: '#f59e0b' },
                        { key: 'guestQuestionsAnswered', name: 'Questions Answered', color: '#ec4899' },
                    ]}
                    loading={usageLoading}
                    height={250}
                />
            </div>

            {/* API Errors Section */}
            <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3">API Errors</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                        <StackedAreaChart
                            title="Error Timeline"
                            subtitle="Errors by status code over time"
                            data={opsMetrics?.apiErrors?.timeSeries ?? []}
                            areas={[
                                { key: 'status404', name: '404', color: '#f59e0b' },
                                { key: 'status500', name: '500', color: '#ef4444' },
                                { key: 'other4xx', name: 'Other 4xx', color: '#6b7280' },
                                { key: 'other5xx', name: 'Other 5xx', color: '#dc2626' },
                            ]}
                            loading={opsLoading}
                            height={220}
                        />
                    </div>
                    <div className="space-y-3">
                        <MetricCard
                            title="404 Errors"
                            value={opsMetrics?.apiErrors?.totals?.status404 ?? 0}
                            color="yellow"
                            size="sm"
                            loading={opsLoading}
                        />
                        <MetricCard
                            title="500 Errors"
                            value={opsMetrics?.apiErrors?.totals?.status500 ?? 0}
                            color={opsMetrics?.apiErrors?.totals?.status500 && opsMetrics.apiErrors.totals.status500 > 0 ? 'red' : 'green'}
                            size="sm"
                            loading={opsLoading}
                        />
                        <MetricCard
                            title="Other 4xx"
                            value={opsMetrics?.apiErrors?.totals?.other4xx ?? 0}
                            color="gray"
                            size="sm"
                            loading={opsLoading}
                        />
                        <MetricCard
                            title="Other 5xx"
                            value={opsMetrics?.apiErrors?.totals?.other5xx ?? 0}
                            color={opsMetrics?.apiErrors?.totals?.other5xx && opsMetrics.apiErrors.totals.other5xx > 0 ? 'red' : 'green'}
                            size="sm"
                            loading={opsLoading}
                        />
                    </div>
                </div>
            </section>

            {/* Cron Jobs Section */}
            <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Cron Jobs</h3>
                <DataTable
                    data={opsMetrics?.cronJobs ?? []}
                    keyField="jobName"
                    loading={opsLoading}
                    compact
                    columns={[
                        {
                            key: 'displayName',
                            header: 'Job',
                            render: (row) => (
                                <div>
                                    <div className="font-medium">{row.displayName}</div>
                                    <div className="text-xs text-gray-500">{row.schedule}</div>
                                </div>
                            ),
                        },
                        {
                            key: 'health',
                            header: 'Status',
                            render: (row) => (
                                <StatusBadge
                                    status={row.health}
                                    variant={getStatusVariant(row.health)}
                                />
                            ),
                        },
                        {
                            key: 'lastExecution',
                            header: 'Last Run',
                            render: (row) => row.lastExecution ? (
                                <div className="text-xs">
                                    <div>{new Date(row.lastExecution.startedAt).toLocaleString()}</div>
                                    {row.lastExecution.durationMs && (
                                        <div className="text-gray-500">{row.lastExecution.durationMs}ms</div>
                                    )}
                                </div>
                            ) : (
                                <span className="text-gray-400">Never</span>
                            ),
                        },
                        {
                            key: 'stats',
                            header: 'Stats',
                            render: (row) => (
                                <div className="text-xs">
                                    <span className="text-green-600">{row.stats.successful}</span>
                                    {' / '}
                                    <span className="text-red-600">{row.stats.failed}</span>
                                    {' / '}
                                    <span className="text-gray-500">{row.stats.total}</span>
                                </div>
                            ),
                        },
                        {
                            key: 'avgDurationMs',
                            header: 'Avg Duration',
                            align: 'right',
                            render: (row) => row.stats.avgDurationMs 
                                ? `${row.stats.avgDurationMs}ms`
                                : '-',
                        },
                    ]}
                />
            </section>
        </div>
    )
}

