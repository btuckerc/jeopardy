'use client'

import { ReactNode } from 'react'
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts'

// Color palette for charts
const COLORS = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    pink: '#ec4899',
    gray: '#6b7280',
}

const CHART_COLORS = [
    COLORS.primary,
    COLORS.success,
    COLORS.warning,
    COLORS.danger,
    COLORS.purple,
    COLORS.cyan,
    COLORS.pink,
    COLORS.gray,
]

interface ChartContainerProps {
    title: string
    subtitle?: string
    children: ReactNode
    height?: number
    loading?: boolean
    actions?: ReactNode
}

export function ChartContainer({
    title,
    subtitle,
    children,
    height = 300,
    loading = false,
    actions,
}: ChartContainerProps) {
    return (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                    {subtitle && (
                        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                    )}
                </div>
                {actions && <div className="flex gap-2">{actions}</div>}
            </div>
            
            {loading ? (
                <div 
                    className="flex items-center justify-center bg-gray-50 rounded animate-pulse"
                    style={{ height }}
                >
                    <p className="text-gray-400">Loading...</p>
                </div>
            ) : (
                <div style={{ height }}>
                    {children}
                </div>
            )}
        </div>
    )
}

interface TimeSeriesData {
    timestamp: string
    [key: string]: string | number
}

interface TimeSeriesChartProps {
    data: TimeSeriesData[]
    lines: Array<{
        key: string
        name: string
        color?: string
    }>
    title: string
    subtitle?: string
    height?: number
    loading?: boolean
    yAxisLabel?: string
    formatValue?: (value: number) => string
    formatTimestamp?: (timestamp: string) => string
}

export function TimeSeriesChart({
    data,
    lines,
    title,
    subtitle,
    height = 300,
    loading = false,
    yAxisLabel,
    formatValue = (v) => v.toLocaleString(),
    formatTimestamp,
}: TimeSeriesChartProps) {
    const formatXAxis = (timestamp: string) => {
        if (formatTimestamp) return formatTimestamp(timestamp)
        
        const date = new Date(timestamp)
        // Check if hourly data (has time component)
        if (timestamp.includes('T') && !timestamp.endsWith('T00:00:00.000Z')) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric' })
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <ChartContainer title={title} subtitle={subtitle} height={height} loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatXAxis}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        stroke="#9ca3af"
                    />
                    <YAxis 
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        stroke="#9ca3af"
                        label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 11 } : undefined}
                    />
                    <Tooltip 
                        formatter={(value: number | undefined) => value !== undefined ? [formatValue(value)] : ['']}
                        labelFormatter={(timestamp: string) => {
                            const date = new Date(timestamp)
                            return date.toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                            })
                        }}
                        contentStyle={{ 
                            fontSize: 12, 
                            backgroundColor: 'white', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            color: '#1f2937'
                        }}
                        labelStyle={{ color: '#374151', fontWeight: 600 }}
                        itemStyle={{ color: '#4b5563' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {lines.map((line, i) => (
                        <Line
                            key={line.key}
                            type="monotone"
                            dataKey={line.key}
                            name={line.name}
                            stroke={line.color || CHART_COLORS[i % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    )
}

interface AreaChartProps {
    data: TimeSeriesData[]
    areas: Array<{
        key: string
        name: string
        color?: string
    }>
    title: string
    subtitle?: string
    height?: number
    loading?: boolean
    stacked?: boolean
}

export function StackedAreaChart({
    data,
    areas,
    title,
    subtitle,
    height = 300,
    loading = false,
    stacked = true,
}: AreaChartProps) {
    const formatXAxis = (timestamp: string) => {
        const date = new Date(timestamp)
        if (timestamp.includes('T') && !timestamp.endsWith('T00:00:00.000Z')) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric' })
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return (
        <ChartContainer title={title} subtitle={subtitle} height={height} loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatXAxis}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        stroke="#9ca3af"
                    />
                    <YAxis 
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        stroke="#9ca3af"
                    />
                    <Tooltip 
                        labelFormatter={(timestamp: string) => {
                            const date = new Date(timestamp)
                            return date.toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric'
                            })
                        }}
                        contentStyle={{ 
                            fontSize: 12, 
                            backgroundColor: 'white', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            color: '#1f2937'
                        }}
                        labelStyle={{ color: '#374151', fontWeight: 600 }}
                        itemStyle={{ color: '#4b5563' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {areas.map((area, i) => (
                        <Area
                            key={area.key}
                            type="monotone"
                            dataKey={area.key}
                            name={area.name}
                            stroke={area.color || CHART_COLORS[i % CHART_COLORS.length]}
                            fill={area.color || CHART_COLORS[i % CHART_COLORS.length]}
                            fillOpacity={0.3}
                            stackId={stacked ? '1' : undefined}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </ChartContainer>
    )
}

interface BarChartData {
    name: string
    value: number
    [key: string]: string | number
}

interface HorizontalBarChartProps {
    data: BarChartData[]
    title: string
    subtitle?: string
    height?: number
    loading?: boolean
    color?: string
    formatValue?: (value: number) => string
}

export function HorizontalBarChart({
    data,
    title,
    subtitle,
    height = 300,
    loading = false,
    color = COLORS.primary,
    formatValue = (v) => v.toLocaleString(),
}: HorizontalBarChartProps) {
    return (
        <ChartContainer title={title} subtitle={subtitle} height={height} loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                    data={data} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis 
                        type="category" 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        width={70}
                    />
                    <Tooltip 
                        formatter={(value: number | undefined) => value !== undefined ? [formatValue(value)] : ['']}
                        contentStyle={{ 
                            fontSize: 12, 
                            backgroundColor: 'white', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            color: '#1f2937'
                        }}
                        labelStyle={{ color: '#374151', fontWeight: 600 }}
                        itemStyle={{ color: '#4b5563' }}
                    />
                    <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    )
}

interface DonutChartProps {
    data: Array<{ name: string; value: number }>
    title: string
    subtitle?: string
    height?: number
    loading?: boolean
    centerLabel?: string
    centerValue?: string | number
}

export function DonutChart({
    data,
    title,
    subtitle,
    height = 250,
    loading = false,
    centerLabel,
    centerValue,
}: DonutChartProps) {
    return (
        <ChartContainer title={title} subtitle={subtitle} height={height} loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ 
                            fontSize: 12, 
                            backgroundColor: 'white', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            color: '#1f2937'
                        }}
                        labelStyle={{ color: '#374151', fontWeight: 600 }}
                        itemStyle={{ color: '#4b5563' }}
                    />
                    <Legend 
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value) => <span className="text-gray-700">{value}</span>}
                    />
                    {/* Center text */}
                    {(centerLabel || centerValue) && (
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                            {centerValue && (
                                <tspan x="50%" dy="-0.5em" className="text-2xl font-bold fill-gray-900">
                                    {centerValue}
                                </tspan>
                            )}
                            {centerLabel && (
                                <tspan x="50%" dy="1.5em" className="text-xs fill-gray-500">
                                    {centerLabel}
                                </tspan>
                            )}
                        </text>
                    )}
                </PieChart>
            </ResponsiveContainer>
        </ChartContainer>
    )
}

// Sparkline component for inline small charts
interface SparklineProps {
    data: number[]
    width?: number
    height?: number
    color?: string
    showArea?: boolean
}

export function Sparkline({
    data,
    width = 100,
    height = 30,
    color = COLORS.primary,
    showArea = true,
}: SparklineProps) {
    const chartData = data.map((value, index) => ({ index, value }))

    return (
        <ResponsiveContainer width={width} height={height}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                {showArea && (
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.2}
                        strokeWidth={1.5}
                    />
                )}
                {!showArea && (
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={1.5}
                        dot={false}
                    />
                )}
            </AreaChart>
        </ResponsiveContainer>
    )
}

