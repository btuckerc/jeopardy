'use client'

interface CategoryData {
    name: string
    correct: number
    total: number
    accuracy: number
}

interface CategoryChartProps {
    data: CategoryData[]
}

export default function CategoryChart({ data }: CategoryChartProps) {
    // Sort by accuracy ascending (weakest first)
    const sortedData = [...data].sort((a, b) => a.accuracy - b.accuracy)
    
    if (data.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500">No category data yet. Start playing to see your progress!</p>
            </div>
        )
    }
    
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Performance by Category</h3>
            
            <div className="space-y-4">
                {sortedData.map((category) => (
                    <div key={category.name}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 truncate flex-1 mr-4">
                                {category.name}
                            </span>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-gray-500">
                                    {category.correct}/{category.total}
                                </span>
                                <span className={`font-bold ${
                                    category.accuracy >= 70 ? 'text-green-600' :
                                    category.accuracy >= 50 ? 'text-amber-600' :
                                    'text-red-600'
                                }`}>
                                    {category.accuracy}%
                                </span>
                            </div>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    category.accuracy >= 70 ? 'bg-green-500' :
                                    category.accuracy >= 50 ? 'bg-amber-500' :
                                    'bg-red-500'
                                }`}
                                style={{ width: `${category.accuracy}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
