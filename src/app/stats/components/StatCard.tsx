interface StatCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ReactNode
    color: 'blue' | 'amber' | 'green' | 'purple'
    trend?: {
        value: number
        isPositive: boolean
    }
}

const colorClasses = {
    blue: {
        bg: 'bg-blue-100',
        text: 'text-blue-600',
        border: 'border-blue-200'
    },
    amber: {
        bg: 'bg-amber-100',
        text: 'text-amber-600',
        border: 'border-amber-200'
    },
    green: {
        bg: 'bg-green-100',
        text: 'text-green-600',
        border: 'border-green-200'
    },
    purple: {
        bg: 'bg-purple-100',
        text: 'text-purple-600',
        border: 'border-purple-200'
    }
}

export default function StatCard({ title, value, subtitle, icon, color, trend }: StatCardProps) {
    const colors = colorClasses[color]
    
    return (
        <div className={`bg-white rounded-2xl shadow-lg border-2 ${colors.border} p-6 transition-transform hover:scale-[1.02]`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {subtitle && (
                        <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
                    )}
                    {trend && (
                        <div className={`flex items-center gap-1 mt-2 text-sm ${
                            trend.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                            {trend.isPositive ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                </svg>
                            )}
                            <span>{trend.value}%</span>
                        </div>
                    )}
                </div>
                <div className={`w-12 h-12 ${colors.bg} ${colors.text} rounded-xl flex items-center justify-center`}>
                    {icon}
                </div>
            </div>
        </div>
    )
}
