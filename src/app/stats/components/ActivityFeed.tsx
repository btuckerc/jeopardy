'use client'

interface Activity {
    id: string
    type: 'game_completed' | 'daily_challenge' | 'achievement' | 'practice'
    title: string
    description: string
    timestamp: string
    metadata?: {
        score?: number
        correct?: boolean
        category?: string
    }
}

interface ActivityFeedProps {
    activities: Activity[]
}

const typeConfig = {
    game_completed: {
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        bg: 'bg-blue-100',
        color: 'text-blue-600'
    },
    daily_challenge: {
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
        bg: 'bg-amber-100',
        color: 'text-amber-600'
    },
    achievement: {
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
        ),
        bg: 'bg-purple-100',
        color: 'text-purple-600'
    },
    practice: {
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
        bg: 'bg-green-100',
        color: 'text-green-600'
    }
}

function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
    if (activities.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500">No recent activity. Start playing to see your history!</p>
            </div>
        )
    }
    
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
            
            <div className="space-y-4">
                {activities.map((activity) => {
                    const config = typeConfig[activity.type]
                    
                    return (
                        <div 
                            key={activity.id}
                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            <div className={`w-10 h-10 ${config.bg} ${config.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                {config.icon}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h4 className="font-semibold text-gray-900 text-sm">
                                            {activity.title}
                                        </h4>
                                        <p className="text-gray-600 text-sm mt-0.5">
                                            {activity.description}
                                        </p>
                                        {activity.metadata?.score !== undefined && (
                                            <p className="text-sm font-medium text-gray-700 mt-1">
                                                Score: ${activity.metadata.score.toLocaleString()}
                                            </p>
                                        )}
                                        {activity.metadata?.correct !== undefined && (
                                            <span className={`inline-flex items-center gap-1 text-xs font-medium mt-1 ${
                                                activity.metadata.correct ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {activity.metadata.correct ? (
                                                    <>
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Correct
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                        Incorrect
                                                    </>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                        {formatRelativeTime(activity.timestamp)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
