export default function GuestGameLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-2 md:p-4">
            {/* Score bar */}
            <div className="flex justify-between items-center mb-4 px-2">
                <div className="h-6 w-24 bg-white/20 rounded animate-pulse"></div>
                <div className="h-8 w-20 bg-white/20 rounded animate-pulse"></div>
                <div className="h-6 w-24 bg-white/20 rounded animate-pulse"></div>
            </div>
            
            {/* Game board skeleton */}
            <div className="grid grid-cols-6 gap-1 md:gap-2">
                {/* Category headers */}
                {[1, 2, 3, 4, 5, 6].map((col) => (
                    <div key={`header-${col}`} className="h-16 bg-blue-800/50 rounded animate-pulse"></div>
                ))}
                
                {/* Question cells */}
                {[1, 2, 3, 4, 5].map((row) => (
                    [1, 2, 3, 4, 5, 6].map((col) => (
                        <div 
                            key={`cell-${row}-${col}`} 
                            className="h-16 md:h-20 bg-blue-700/50 rounded animate-pulse"
                        ></div>
                    ))
                ))}
            </div>
        </div>
    )
}

