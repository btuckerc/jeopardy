'use client'

import { MetricCard, MetricGrid } from '../MetricCard'
import { DonutChart, HorizontalBarChart } from '../Charts'
import { DataTable, StatusBadge } from '../DataTable'
import { useContentMetrics } from '../../hooks/useAdminQueries'

export function ContentQualityTab() {
    const { data: content, isLoading } = useContentMetrics()

    // Transform distribution data for charts
    const roundData = content?.distribution.byRound.map(r => ({
        name: r.round,
        value: r.count,
    })) ?? []

    const knowledgeCategoryData = content?.distribution.byKnowledgeCategory.map(k => ({
        name: k.category.replace(/_/g, ' '),
        value: k.count,
    })) ?? []

    const difficultyData = content?.distribution.byDifficulty.map(d => ({
        name: d.difficulty,
        value: d.count,
    })) ?? []

    const seasonData = content?.distribution.bySeason.map(s => ({
        name: `Season ${s.season}`,
        value: s.count,
    })) ?? []

    return (
        <div className="space-y-8">
            {/* Overview Section */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Content Overview</h2>
                <MetricGrid columns={6}>
                    <MetricCard
                        title="Total Questions"
                        value={content?.overview.totalQuestions ?? 0}
                        color="blue"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Categories"
                        value={content?.overview.totalCategories ?? 0}
                        color="purple"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="With Air Date"
                        value={content?.overview.questionsWithAirDate ?? 0}
                        subtitle={`${((content?.overview.questionsWithAirDate ?? 0) / (content?.overview.totalQuestions ?? 1) * 100).toFixed(1)}% of total`}
                        color="green"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Without Air Date"
                        value={content?.overview.questionsWithoutAirDate ?? 0}
                        color="gray"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Triple Stumpers"
                        value={content?.overview.tripleStumperCount ?? 0}
                        subtitle={`${(content?.overview.tripleStumperRate ?? 0).toFixed(1)}% of total`}
                        color="yellow"
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Daily Challenges"
                        value={content?.overview.dailyChallengesGenerated ?? 0}
                        subtitle="generated"
                        color="purple"
                        loading={isLoading}
                    />
                </MetricGrid>
            </section>

            {/* Coverage Section */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Air Date Coverage</h2>
                <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Date Range</p>
                            <p className="text-sm font-medium text-gray-900">
                                {content?.coverage.airDateRange.earliest 
                                    ? new Date(content.coverage.airDateRange.earliest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                    : 'N/A'
                                }
                                {' → '}
                                {content?.coverage.airDateRange.latest
                                    ? new Date(content.coverage.airDateRange.latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                    : 'N/A'
                                }
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Days with Data</p>
                            <p className="text-sm font-medium text-gray-900">{content?.coverage.daysWithData ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Total Days in Range</p>
                            <p className="text-sm font-medium text-gray-900">{content?.coverage.totalDaysInRange ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Coverage</p>
                            <p className="text-sm font-bold text-blue-600">
                                {(content?.coverage.coveragePercent ?? 0).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    
                    {/* Coverage Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                            className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, content?.coverage.coveragePercent ?? 0)}%` }}
                        />
                    </div>
                </div>
            </section>

            {/* Distribution Charts */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribution</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <DonutChart
                        title="By Round"
                        data={roundData}
                        loading={isLoading}
                        height={220}
                    />
                    <DonutChart
                        title="By Difficulty"
                        data={difficultyData}
                        loading={isLoading}
                        height={220}
                    />
                    <div className="lg:col-span-2">
                        <HorizontalBarChart
                            title="By Knowledge Category"
                            data={knowledgeCategoryData}
                            loading={isLoading}
                            height={220}
                            color="#8b5cf6"
                        />
                    </div>
                </div>
            </section>

            {/* Season Distribution */}
            {seasonData.length > 0 && (
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Seasons</h2>
                    <HorizontalBarChart
                        title="Questions by Season"
                        subtitle="Top 10 seasons by question count"
                        data={seasonData}
                        loading={isLoading}
                        height={300}
                        color="#3b82f6"
                    />
                </section>
            )}

            {/* Hot Questions (Most Disputed/Reported) */}
            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Hot Questions</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Questions with the most disputes and issue reports in the last 30 days
                </p>
                <DataTable
                    data={content?.hotQuestions ?? []}
                    keyField="id"
                    loading={isLoading}
                    compact
                    maxHeight="400px"
                    stickyHeader
                    columns={[
                        {
                            key: 'totalIssues',
                            header: 'Issues',
                            width: '80px',
                            align: 'center',
                            sortable: true,
                            render: (row) => (
                                <span className={`
                                    font-bold
                                    ${row.totalIssues >= 5 ? 'text-red-600' : 
                                      row.totalIssues >= 3 ? 'text-yellow-600' : 'text-gray-600'}
                                `}>
                                    {row.totalIssues}
                                </span>
                            ),
                        },
                        {
                            key: 'category',
                            header: 'Category',
                            width: '150px',
                            render: (row) => (
                                <span className="font-medium text-gray-700">{row.category}</span>
                            ),
                        },
                        {
                            key: 'question',
                            header: 'Question',
                            render: (row) => (
                                <span className="text-xs" title={row.question}>{row.question}</span>
                            ),
                        },
                        {
                            key: 'answer',
                            header: 'Answer',
                            width: '180px',
                            render: (row) => (
                                <span className="font-medium text-green-700">{row.answer}</span>
                            ),
                        },
                        {
                            key: 'value',
                            header: 'Value',
                            width: '80px',
                            align: 'right',
                            render: (row) => `$${row.value}`,
                        },
                        {
                            key: 'round',
                            header: 'Round',
                            width: '80px',
                            render: (row) => (
                                <StatusBadge status={row.round} variant="info" />
                            ),
                        },
                        {
                            key: 'breakdown',
                            header: 'Breakdown',
                            width: '100px',
                            render: (row) => (
                                <div className="text-xs">
                                    <span className="text-red-600">{row.disputeCount} disputes</span>
                                    <br />
                                    <span className="text-yellow-600">{row.issueCount} issues</span>
                                </div>
                            ),
                        },
                    ]}
                />
            </section>
        </div>
    )
}

