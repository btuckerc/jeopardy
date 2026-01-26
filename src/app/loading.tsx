export default function HomeLoading() {
    return (
        <div className="relative overflow-hidden">
            {/* Background gradient - matches page.tsx */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-amber-50 -z-10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent -z-10" />
            
            <div className="container mx-auto pt-8 pb-12 sm:pt-8 sm:pb-16">
                {/* Header skeleton */}
                <div className="text-center max-w-4xl mx-auto mb-8 md:mb-12">
                    <div className="h-12 w-64 mx-auto bg-gray-200 rounded animate-pulse mb-4"></div>
                    <div className="h-6 w-96 max-w-full mx-auto bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Stats cards skeleton */}
                <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 max-w-md mx-auto mb-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
                    ))}
                </div>
                
                {/* Daily Challenge Card skeleton */}
                <div className="mt-8 max-w-4xl mx-auto mb-8">
                    <div className="h-64 bg-gray-200 rounded-2xl animate-pulse"></div>
                </div>
                
                {/* Main action buttons skeleton */}
                <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 max-w-4xl mx-auto">
                    <div className="h-64 bg-gray-200 rounded-2xl animate-pulse"></div>
                    <div className="h-64 bg-gray-200 rounded-2xl animate-pulse"></div>
                </div>
            </div>
        </div>
    )
}

