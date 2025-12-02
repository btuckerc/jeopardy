'use client'

interface DataPoint {
    timestamp: string
    value: number
}

interface SimpleLineChartProps {
    data: DataPoint[]
    title: string
    color?: string
    height?: number
    showGrid?: boolean
}

export function SimpleLineChart({ 
    data, 
    title, 
    color = '#3b82f6', 
    height = 200,
    showGrid = true 
}: SimpleLineChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-gray-200">
                <p className="text-gray-500">No data available</p>
            </div>
        )
    }

    const padding = { top: 20, right: 20, bottom: 40, left: 50 }
    const chartWidth = 800
    const chartHeight = height
    const innerWidth = chartWidth - padding.left - padding.right
    const innerHeight = chartHeight - padding.top - padding.bottom

    // Calculate min/max values
    const values = data.map(d => d.value)
    const maxValue = Math.max(...values, 1) // At least 1 to avoid division by zero
    const minValue = Math.min(...values, 0)

    // Calculate points
    const points = data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1 || 1)) * innerWidth
        const y = padding.top + innerHeight - ((d.value - minValue) / (maxValue - minValue || 1)) * innerHeight
        return { x, y, value: d.value, timestamp: d.timestamp }
    })

    // Create path for line
    const pathData = points.map((p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`
        return `L ${p.x} ${p.y}`
    }).join(' ')

    // Format timestamp for display
    const formatTimestamp = (ts: string) => {
        const date = new Date(ts)
        if (ts.includes('T') && ts.includes(':')) {
            // Hourly format
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
        }
        // Daily format
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    // X-axis labels (show every nth label to avoid crowding)
    const labelInterval = Math.max(1, Math.floor(data.length / 6))
    const xLabels = data.filter((_, i) => i % labelInterval === 0 || i === data.length - 1)

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-full">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
                <svg 
                    width={chartWidth} 
                    height={chartHeight} 
                    className="w-full h-auto"
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Grid lines */}
                    {showGrid && (
                        <>
                            {/* Horizontal grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                                const y = padding.top + innerHeight - (ratio * innerHeight)
                                const value = minValue + (maxValue - minValue) * ratio
                                return (
                                    <g key={`grid-h-${ratio}`}>
                                        <line
                                            x1={padding.left}
                                            y1={y}
                                            x2={padding.left + innerWidth}
                                            y2={y}
                                            stroke="#e5e7eb"
                                            strokeWidth="1"
                                            strokeDasharray="4 4"
                                        />
                                        <text
                                            x={padding.left - 10}
                                            y={y + 4}
                                            textAnchor="end"
                                            fontSize="10"
                                            fill="#6b7280"
                                        >
                                            {Math.round(value)}
                                        </text>
                                    </g>
                                )
                            })}
                        </>
                    )}

                    {/* Line */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Area under line */}
                    <path
                        d={`${pathData} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`}
                        fill={color}
                        fillOpacity="0.1"
                    />

                    {/* Data points */}
                    {points.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill={color}
                            stroke="white"
                            strokeWidth="2"
                        />
                    ))}

                    {/* X-axis labels */}
                    {xLabels.map((d, i) => {
                        const pointIndex = data.findIndex(item => item.timestamp === d.timestamp)
                        if (pointIndex === -1) return null
                        const x = padding.left + (pointIndex / (data.length - 1 || 1)) * innerWidth
                        return (
                            <text
                                key={i}
                                x={x}
                                y={chartHeight - 5}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#6b7280"
                            >
                                {formatTimestamp(d.timestamp)}
                            </text>
                        )
                    })}
                </svg>
            </div>
        </div>
    )
}

