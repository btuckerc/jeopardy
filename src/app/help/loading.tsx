export default function HelpLoading() {
    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="h-10 w-48 mx-auto bg-gray-200 rounded animate-pulse mb-4"></div>
                    <div className="h-5 w-72 mx-auto bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* FAQ sections */}
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-6 shadow animate-pulse">
                            <div className="h-6 w-3/4 bg-gray-200 rounded mb-3"></div>
                            <div className="space-y-2">
                                <div className="h-4 w-full bg-gray-100 rounded"></div>
                                <div className="h-4 w-5/6 bg-gray-100 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

