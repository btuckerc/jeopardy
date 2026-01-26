export default function SettingsLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="h-9 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-5 w-56 bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Settings sections */}
                <div className="space-y-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-6 shadow animate-pulse">
                            <div className="h-6 w-40 bg-gray-200 rounded mb-4"></div>
                            <div className="space-y-4">
                                <div className="h-10 w-full bg-gray-100 rounded"></div>
                                <div className="h-10 w-full bg-gray-100 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

