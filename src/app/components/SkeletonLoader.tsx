interface SkeletonProps {
    className?: string
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse ${className}`}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
            </div>
        </div>
    )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <div 
                    key={i} 
                    className="h-4 bg-gray-200 rounded animate-pulse"
                    style={{ width: i === lines - 1 ? '60%' : '100%' }}
                />
            ))}
        </div>
    )
}

export function SkeletonAvatar({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16'
    }
    
    return (
        <div className={`${sizeClasses[size]} bg-gray-200 rounded-full animate-pulse ${className}`} />
    )
}

export function SkeletonButton({ className = '' }: SkeletonProps) {
    return (
        <div className={`h-10 bg-gray-200 rounded-lg animate-pulse ${className}`} />
    )
}

export function SkeletonGameBoard({ className = '' }: SkeletonProps) {
    return (
        <div className={`space-y-4 ${className}`}>
            {/* Header */}
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
            
            {/* Grid */}
            <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 36 }).map((_, i) => (
                    <div 
                        key={i} 
                        className="aspect-square bg-gray-200 rounded-lg animate-pulse"
                    />
                ))}
            </div>
        </div>
    )
}

export function SkeletonStats({ className = '' }: SkeletonProps) {
    return (
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
            ))}
        </div>
    )
}

export default {
    Card: SkeletonCard,
    Text: SkeletonText,
    Avatar: SkeletonAvatar,
    Button: SkeletonButton,
    GameBoard: SkeletonGameBoard,
    Stats: SkeletonStats
}
