'use client'

import { ReactNode } from 'react'
import { DonutChart, HorizontalBarChart, TimeSeriesChart } from '../Charts'
import { DataTable, StatusBadge, getStatusVariant } from '../DataTable'
import { useLiveMetrics, useOpsMetrics, useUsageMetrics } from '../../hooks/useAdminQueries'
import { getAdminReportingWindowLabel, type AdminReportingWindow } from '../../lib/reporting'

interface MetricsOverviewTabProps {
    window: AdminReportingWindow
}

type AccentTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate'

const accentStyles: Record<AccentTone, string> = {
    blue: 'from-blue-500 via-sky-500 to-cyan-400',
    emerald: 'from-emerald-500 via-teal-500 to-cyan-400',
    amber: 'from-cyan-500 via-sky-500 to-blue-400',
    rose: 'from-indigo-500 via-blue-500 to-cyan-400',
    purple: 'from-indigo-500 via-sky-500 to-cyan-400',
    slate: 'from-slate-600 via-slate-500 to-slate-300',
}

const tintStyles: Record<AccentTone, string> = {
    blue: 'border-blue-200 bg-blue-50/70 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-700',
    rose: 'border-rose-200 bg-rose-50/70 text-rose-700',
    purple: 'border-violet-200 bg-violet-50/70 text-violet-700',
    slate: 'border-slate-200 bg-slate-50/80 text-slate-700',
}

function formatPercent(value: number | undefined, digits = 1): string {
    return `${(value ?? 0).toFixed(digits)}%`
}

function formatDecimal(value: number | undefined, digits = 1): string {
    return (value ?? 0).toFixed(digits)
}

function OverviewSection({
    eyebrow,
    title,
    description,
    accent = 'blue',
    actions,
    children,
    className,
    headerClassName,
}: {
    eyebrow: string
    title: string
    description?: string
    accent?: AccentTone
    actions?: ReactNode
    children: ReactNode
    className?: string
    headerClassName?: string
}) {
    return (
        <section className={`relative overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] ${className || ''}`}>
            <div className="px-5 pt-5 sm:px-6 sm:pt-6 lg:px-7 lg:pt-7">
                <div className={`h-1.5 rounded-full bg-gradient-to-r ${accentStyles[accent]}`} />
            </div>
            <div className="p-5 pt-4 sm:p-6 sm:pt-5 lg:p-7 lg:pt-5">
                <div className={`mb-5 flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between ${headerClassName || ''}`}>
                    <div className="min-w-0">
                        <div className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-slate-400 sm:text-[0.68rem]">{eyebrow}</div>
                        <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight leading-tight text-slate-950 sm:text-[1.9rem]">{title}</h2>
                        {description ? <p className="mt-2 max-w-3xl text-[0.92rem] leading-6 text-slate-500">{description}</p> : null}
                    </div>
                    {actions ? <div className="w-full shrink-0 lg:w-auto">{actions}</div> : null}
                </div>
                {children}
            </div>
        </section>
    )
}

function HeroMetric({
    label,
    value,
    detail,
    accent = 'blue',
}: {
    label: string
    value: string | number
    detail: string
    accent?: AccentTone
}) {
    const valueClassName =
        typeof value === 'string' && value.length > 8
            ? 'text-[1.5rem] sm:text-[1.7rem]'
            : 'text-[1.65rem] sm:text-[1.95rem]'

    return (
        <div className={`rounded-[24px] border px-4 py-4 sm:px-5 ${tintStyles[accent]}`}>
            <div className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] opacity-70 sm:text-[0.68rem]">{label}</div>
            <div className={`mt-3 break-words leading-none font-semibold tracking-tight text-slate-950 ${valueClassName}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div className="mt-2 text-[0.92rem] leading-6 text-slate-600">{detail}</div>
        </div>
    )
}

function SignalCard({
    title,
    value,
    description,
    kicker,
    accent = 'slate',
}: {
    title: string
    value: string | number
    description: string
    kicker?: string
    accent?: AccentTone
}) {
    const stringValue = typeof value === 'string' ? value : null
    const valueClassName =
        stringValue && stringValue.length > 8
            ? 'text-[1.4rem] sm:text-[1.75rem]'
            : 'text-[1.7rem] sm:text-[2.15rem]'

    return (
        <div className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.45)] transition-transform duration-200 hover:-translate-y-0.5">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentStyles[accent]}`} />
            <div className="flex h-full flex-col pt-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="text-[1rem] font-semibold leading-8 text-slate-900 sm:text-[1.1rem]">{title}</div>
                        <div className={`mt-1 break-words leading-[0.95] font-semibold tracking-tight text-slate-950 ${valueClassName}`}>
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </div>
                    </div>
                    {kicker ? (
                        <div className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.14em] sm:px-3 sm:text-[0.64rem] ${tintStyles[accent]}`}>
                            {kicker}
                        </div>
                    ) : null}
                </div>
                <p className="mt-3 text-[0.92rem] leading-6 text-slate-500">{description}</p>
            </div>
        </div>
    )
}

function JourneyStepRow({
    step,
    label,
    value,
    percent,
    detail,
}: {
    step: string
    label: string
    value: number
    percent?: number
    detail: string
}) {
    const normalizedPercent = Math.max(0, Math.min(100, percent ?? 0))
    return (
        <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.4)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-slate-400">{step}</div>
                    <div className="mt-2 text-[1.05rem] font-semibold text-slate-900 sm:text-[1.2rem]">{label}</div>
                </div>
                <div className="shrink-0">
                    <div className="text-[2rem] font-semibold leading-none tracking-tight text-slate-950">{value.toLocaleString()}</div>
                    {percent !== undefined ? (
                        <div className="mt-1 text-right text-xs font-medium text-slate-500">{formatPercent(percent)}</div>
                    ) : null}
                </div>
            </div>
            <p className="mt-3 text-[0.92rem] leading-6 text-slate-500">{detail}</p>
            {percent !== undefined ? (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${normalizedPercent}%` }} />
                </div>
            ) : null}
        </div>
    )
}

function InsightList({
    items,
}: {
    items: Array<{ label: string; value: string; tone?: AccentTone }>
}) {
    return (
        <div className="space-y-3">
            {items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0 text-[0.92rem] font-medium text-slate-600">{item.label}</div>
                    <div className={`rounded-full border px-3 py-1 text-[0.92rem] font-semibold ${tintStyles[item.tone || 'slate']}`}>
                        {item.value}
                    </div>
                </div>
            ))}
        </div>
    )
}

export function MetricsOverviewTab({ window }: MetricsOverviewTabProps) {
    const { data: usageMetrics, isLoading: usageLoading } = useUsageMetrics(window)
    const { data: opsMetrics, isLoading: opsLoading } = useOpsMetrics(window)
    const { data: liveMetrics, isLoading: liveLoading } = useLiveMetrics()

    const reportingLabel = getAdminReportingWindowLabel(window)
    const usageTimeSeries = usageMetrics?.timeSeries?.map((point) => ({
        ...point,
        timestamp: point.timestamp,
    })) ?? []

    const activationNewUsers = usageMetrics?.activation?.newUsers ?? 0
    const activationWithDisplayName = usageMetrics?.activation?.withDisplayName ?? 0
    const activationWithGames = usageMetrics?.activation?.withGames ?? 0
    const activationWithDailyChallenges = usageMetrics?.activation?.withDailyChallenges ?? 0

    const unhealthyCronJobs = opsMetrics?.cronJobs?.filter((job) => job.health !== 'healthy').length ?? 0

    const healthColor = {
        healthy: 'emerald',
        degraded: 'amber',
        unhealthy: 'rose',
        running: 'blue',
    } as const

    return (
        <div className="space-y-8 pb-4">
            <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1)_0%,rgba(255,255,255,1)_48%,rgba(241,245,249,0.96)_100%)] shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
                <div className="absolute inset-y-0 right-0 w-[40%] bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_58%)]" />
                <div className="absolute left-0 top-0 h-32 w-32 rounded-full bg-blue-200/30 blur-3xl" />
                <div className="relative grid gap-6 p-6 sm:p-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)] xl:gap-7">
                    <div>
                        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-400">System Overview</div>
                        <h2 className="mt-3 max-w-[15ch] text-[1.9rem] font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-[2.15rem] xl:text-[2.35rem]">
                            A cleaner read on activation, stickiness, and live user momentum.
                        </h2>
                        <p className="mt-3 max-w-2xl text-[0.95rem] leading-6 text-slate-500">
                            The overview is now arranged as an operator briefing for {reportingLabel}, with product signals first and secondary diagnostics pushed lower.
                        </p>

                        <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                            <HeroMetric
                                label="Activation"
                                value={formatPercent(usageMetrics?.activation?.activationRate)}
                                detail={`${usageMetrics?.activation?.activatedUsers ?? 0} of ${activationNewUsers} new users activated in ${reportingLabel}`}
                                accent="blue"
                            />
                            <HeroMetric
                                label="Returning Users"
                                value={usageMetrics?.windowSummary?.returningUsers ?? 0}
                                detail={`${formatPercent(usageMetrics?.windowSummary?.returningShare)} of active users are returning`}
                                accent="emerald"
                            />
                            <HeroMetric
                                label="Live Now"
                                value={liveMetrics?.activeNowUsers ?? 0}
                                detail={`Authenticated users seen in the last ${liveMetrics?.activeWindowMinutes ?? 15} minutes`}
                                accent="amber"
                            />
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white/88 p-5 backdrop-blur">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">At A Glance</div>
                                <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-950">Operator pulse</div>
                            </div>
                            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                                {reportingLabel}
                            </div>
                        </div>
                        <InsightList
                            items={[
                                {
                                    label: 'Stickiness',
                                    value: `${formatPercent(usageMetrics?.valueMetrics?.dauMauStickiness)} DAU/MAU`,
                                    tone: 'emerald',
                                },
                                {
                                    label: 'Game completion',
                                    value: formatPercent(usageMetrics?.valueMetrics?.gameCompletionRate),
                                    tone: 'blue',
                                },
                                {
                                    label: 'Daily challenge reach',
                                    value: formatPercent(usageMetrics?.valueMetrics?.dailyParticipationRate),
                                    tone: 'amber',
                                },
                                {
                                    label: 'Top live country',
                                    value: liveMetrics?.activeCountries?.[0]?.name ?? 'Unknown',
                                    tone: 'slate',
                                },
                            ]}
                        />
                    </div>
                </div>
            </section>

            <OverviewSection
                eyebrow="Signal Deck"
                title="The metrics that prove the product is working"
                description="These are the seven numbers worth checking first before diving into charts."
                accent="blue"
            >
                <div className="grid auto-rows-fr gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    <SignalCard
                        title="Activation Rate"
                        value={formatPercent(usageMetrics?.activation?.activationRate)}
                        description={`${usageMetrics?.activation?.activatedUsers ?? 0} users crossed at least one meaningful activation step after signup.`}
                        kicker="funnel"
                        accent="blue"
                    />
                    <SignalCard
                        title="Returning Actives"
                        value={usageMetrics?.windowSummary?.returningUsers ?? 0}
                        description={`${formatPercent(usageMetrics?.windowSummary?.returningShare)} of active users are not brand new, which is the clearest retention read in this view.`}
                        kicker="retention"
                        accent="emerald"
                    />
                    <SignalCard
                        title="Stickiness"
                        value={formatPercent(usageMetrics?.valueMetrics?.dauMauStickiness)}
                        description={`${formatPercent(usageMetrics?.valueMetrics?.wauMauStickiness)} WAU/MAU gives the broader weekly habit signal.`}
                        kicker="habit"
                        accent="emerald"
                    />
                    <SignalCard
                        title="Game Completion"
                        value={formatPercent(usageMetrics?.valueMetrics?.gameCompletionRate)}
                        description={`${formatDecimal(usageMetrics?.valueMetrics?.avgGamesPerPlayer)} starts per player shows whether session depth is healthy.`}
                        kicker="session"
                        accent="amber"
                    />
                    <SignalCard
                        title="Daily Reach"
                        value={formatPercent(usageMetrics?.valueMetrics?.dailyParticipationRate)}
                        description={`${formatDecimal(usageMetrics?.valueMetrics?.avgDailyChallengesPerParticipant)} daily plays per participant keeps the recurring mode honest.`}
                        kicker="repeat"
                        accent="purple"
                    />
                    <SignalCard
                        title="Social Adoption"
                        value={formatPercent(usageMetrics?.social?.socialAdoptionRate)}
                        description={`${usageMetrics?.social?.activeUsersWithFriends ?? 0} active users currently sit inside the social graph.`}
                        kicker="network"
                        accent="rose"
                    />
                    <SignalCard
                        title="Guest Claim Rate"
                        value={formatPercent(usageMetrics?.valueMetrics?.guestClaimRate)}
                        description={`${usageMetrics?.totals?.guestSessionsClaimed ?? 0} guest sessions converted to signed-in ownership.`}
                        kicker="growth"
                        accent="slate"
                    />
                </div>
            </OverviewSection>

            <OverviewSection
                eyebrow="Activation"
                title="New user journey"
                description="A compact activation staircase makes it easier to see where the funnel bends or stalls."
                accent="emerald"
                actions={(
                    <div className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 sm:w-auto">
                        {activationNewUsers.toLocaleString()} new users
                    </div>
                )}
            >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] xl:items-start">
                    <div className="space-y-4">
                        <JourneyStepRow
                            step="Step 1"
                            label="New users"
                            value={activationNewUsers}
                            detail="New accounts created in the selected reporting range."
                        />
                        <JourneyStepRow
                            step="Step 2"
                            label="Activated users"
                            value={usageMetrics?.activation?.activatedUsers ?? 0}
                            percent={usageMetrics?.activation?.activationRate}
                            detail="Reached at least one meaningful activation milestone."
                        />
                        <JourneyStepRow
                            step="Step 3"
                            label="Set display name"
                            value={activationWithDisplayName}
                            percent={activationNewUsers ? (activationWithDisplayName / activationNewUsers) * 100 : 0}
                            detail="A simple identity step that usually indicates first-session intent."
                        />
                        <JourneyStepRow
                            step="Step 4"
                            label="Played a game"
                            value={activationWithGames}
                            percent={activationNewUsers ? (activationWithGames / activationNewUsers) * 100 : 0}
                            detail="The strongest activation checkpoint because it proves users hit the core mode."
                        />
                        <JourneyStepRow
                            step="Step 5"
                            label="Tried daily challenge"
                            value={activationWithDailyChallenges}
                            percent={activationNewUsers ? (activationWithDailyChallenges / activationNewUsers) * 100 : 0}
                            detail="A recurring-mode checkpoint that signals habit potential early."
                        />
                    </div>
                    <div className="flex flex-col rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 xl:sticky xl:top-0">
                        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Read This</div>
                        <div className="mt-3 text-[1.25rem] font-semibold tracking-tight text-slate-950">What to do with this section</div>
                        <p className="mt-3 text-[0.92rem] leading-7 text-slate-500">
                            If activation softens while new users stay stable, the issue is onboarding or first-session friction. If activation holds but returning users fall, the issue is product habit instead.
                        </p>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[0.92rem] leading-7 text-slate-600">
                            Achievement unlocks are tracked too, but display name, first game, and first daily challenge are the cleanest activation checkpoints.
                        </div>
                    </div>
                </div>
            </OverviewSection>

            <OverviewSection
                eyebrow="Behavior"
                title="Trend lines"
                description="These charts keep the eye on momentum instead of raw totals."
                accent="amber"
            >
                <div className="grid gap-4 xl:grid-cols-2">
                    <TimeSeriesChart
                        title="User Activity"
                        subtitle={`New and active users in ${reportingLabel}`}
                        data={usageTimeSeries}
                        lines={[
                            { key: 'newUsers', name: 'New Users', color: '#0f766e' },
                            { key: 'activeUsers', name: 'Active Users', color: '#2563eb' },
                        ]}
                        loading={usageLoading}
                        height={300}
                    />
                    <TimeSeriesChart
                        title="Core Engagement"
                        subtitle="Games started, games completed, and daily challenge plays"
                        data={usageTimeSeries}
                        lines={[
                            { key: 'gamesStarted', name: 'Games Started', color: '#2563eb' },
                            { key: 'gamesCompleted', name: 'Games Completed', color: '#10b981' },
                            { key: 'dailyChallengeSubmissions', name: 'Daily Challenge Plays', color: '#8b5cf6' },
                        ]}
                        loading={usageLoading}
                        height={300}
                    />
                </div>
            </OverviewSection>

            <OverviewSection
                eyebrow="Audience"
                title="Location, acquisition, and live activity"
                description="Historical audience shape plus a near-real-time view of where signed-in users are active and what surfaces they are using."
                accent="blue"
                actions={(
                    <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        refreshes every 30s
                    </div>
                )}
            >
                <div className="grid gap-4 xl:grid-cols-4">
                    <SignalCard
                        title="Live Now"
                        value={liveMetrics?.activeNowUsers ?? 0}
                        description={`Users seen in the last ${liveMetrics?.activeWindowMinutes ?? 15} minutes.`}
                        accent="emerald"
                    />
                    <SignalCard
                        title="Active Last Hour"
                        value={liveMetrics?.activeLastHour ?? 0}
                        description="Authenticated users with recent activity in the last hour."
                        accent="blue"
                    />
                    <SignalCard
                        title="Countries Live"
                        value={liveMetrics?.activeCountries?.length ?? 0}
                        description="Distinct countries represented in the live user set."
                        accent="amber"
                    />
                    <SignalCard
                        title="Top Live Country"
                        value={liveMetrics?.activeCountries?.[0]?.name ?? 'Unknown'}
                        description={liveMetrics?.activeCountries?.[0] ? `${liveMetrics.activeCountries[0].value} users active now.` : 'No recent activity.'}
                        accent="slate"
                    />
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <HorizontalBarChart
                        title="Top Countries"
                        subtitle={`Active users in ${reportingLabel}`}
                        data={usageMetrics?.audience?.countries ?? []}
                        loading={usageLoading}
                        height={280}
                    />
                    <HorizontalBarChart
                        title="Live Countries"
                        subtitle="Users seen in the last 15 minutes"
                        data={liveMetrics?.activeCountries ?? []}
                        loading={liveLoading}
                        height={280}
                        color="#10b981"
                    />
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    <DonutChart
                        title="Device Mix"
                        subtitle="Active users in the last 30 days"
                        data={usageMetrics?.audience?.devices ?? []}
                        loading={usageLoading}
                        height={280}
                        centerLabel="active users"
                        centerValue={usageMetrics?.audience?.activeUsers30d ?? 0}
                    />
                    <HorizontalBarChart
                        title="Live Regions"
                        subtitle="Country + region code where available"
                        data={liveMetrics?.activeRegions ?? []}
                        loading={liveLoading}
                        height={280}
                        color="#06b6d4"
                    />
                    <HorizontalBarChart
                        title="Acquisition Sources"
                        subtitle="First captured UTM source"
                        data={usageMetrics?.audience?.acquisitionSources ?? []}
                        loading={usageLoading}
                        height={280}
                        color="#8b5cf6"
                    />
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <HorizontalBarChart
                        title="Top Referrers"
                        subtitle="First external referrer host"
                        data={usageMetrics?.audience?.referrers ?? []}
                        loading={usageLoading}
                        height={280}
                        color="#334155"
                    />
                    <DataTable
                        title="Live Pages"
                        data={liveMetrics?.activePages ?? []}
                        keyField="name"
                        loading={liveLoading}
                        compact
                        columns={[
                            {
                                key: 'name',
                                header: 'Page',
                                render: (row) => <span className="font-mono text-xs">{row.name}</span>,
                            },
                            {
                                key: 'value',
                                header: 'Active Users',
                                align: 'right',
                                sortable: true,
                            },
                        ]}
                    />
                </div>
            </OverviewSection>

            <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr] xl:items-stretch">
                <OverviewSection
                    eyebrow="Retention"
                    title="Social and repeat-use signals"
                    description="These measures say whether users are coming back and whether the social graph is deepening."
                    accent="rose"
                    className="h-full"
                    headerClassName="xl:min-h-[11rem]"
                >
                    <div className="grid auto-rows-fr gap-4 2xl:grid-cols-2">
                        <SignalCard
                            title="Engaged Users"
                            value={usageMetrics?.windowSummary?.engagedUsers ?? 0}
                            description={`${formatPercent(usageMetrics?.windowSummary?.engagementRate)} of active users played or completed a meaningful mode.`}
                            accent="blue"
                        />
                        <SignalCard
                            title="Users With Friends"
                            value={usageMetrics?.social?.usersWithFriends ?? 0}
                            description={`${usageMetrics?.social?.totalFriendships ?? 0} friendship edges currently exist across the product.`}
                            accent="rose"
                        />
                        <SignalCard
                            title="Challenges Sent"
                            value={usageMetrics?.social?.challengesCreated ?? 0}
                            description={`${formatPercent(usageMetrics?.social?.challengeAcceptanceRate)} of friend challenges are accepted.`}
                            accent="amber"
                        />
                        <SignalCard
                            title="Challenge Completion"
                            value={formatPercent(usageMetrics?.social?.challengeCompletionRate)}
                            description={`${usageMetrics?.social?.challengesCompleted ?? 0} challenges reached completion in the selected window.`}
                            accent="emerald"
                        />
                    </div>
                </OverviewSection>

                <OverviewSection
                    eyebrow="Operations"
                    title="Operational pulse"
                    description="A compact health read belongs here, while deeper API and database analysis stays in Traffic."
                    accent="slate"
                    className="h-full"
                    headerClassName="xl:min-h-[11rem]"
                >
                    <div className="grid auto-rows-fr gap-4 2xl:grid-cols-2">
                        <SignalCard
                            title="System Health"
                            value={opsMetrics?.overallHealth?.toUpperCase() ?? 'LOADING'}
                            description="Overall blended health across cron jobs, disputes, and recent failures."
                            accent={healthColor[opsMetrics?.overallHealth || 'healthy']}
                        />
                        <SignalCard
                            title="Pending Disputes"
                            value={opsMetrics?.disputes?.pending ?? 0}
                            description={`${opsMetrics?.disputes?.recent24h ?? 0} new disputes in the last 24 hours.`}
                            accent={opsMetrics?.disputes?.pending && opsMetrics.disputes.pending > 5 ? 'rose' : 'slate'}
                        />
                        <SignalCard
                            title="API Errors"
                            value={opsMetrics?.apiErrors?.totals?.total ?? 0}
                            description={`Captured application errors in ${reportingLabel}.`}
                            accent={opsMetrics?.apiErrors?.totals?.total ? 'amber' : 'emerald'}
                        />
                        <SignalCard
                            title="Cron Attention"
                            value={unhealthyCronJobs}
                            description={`${opsMetrics?.cronJobs?.length ?? 0} scheduled jobs tracked, ${unhealthyCronJobs} needing attention.`}
                            accent={unhealthyCronJobs > 0 ? 'amber' : 'emerald'}
                        />
                    </div>
                </OverviewSection>
            </div>

            <OverviewSection
                eyebrow="Jobs"
                title="Cron job watchlist"
                description="Still available here, but visually quieter so it does not overpower the product signals above."
                accent="slate"
            >
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
                                    {row.lastExecution.durationMs ? (
                                        <div className="text-gray-500">{row.lastExecution.durationMs}ms</div>
                                    ) : null}
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
                            render: (row) => row.stats.avgDurationMs ? `${row.stats.avgDurationMs}ms` : '-',
                        },
                    ]}
                />
            </OverviewSection>
        </div>
    )
}
