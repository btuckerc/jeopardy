export default function FinalJeopardyPracticeLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                {/* Category */}
                <div className="text-center mb-8">
                    <div className="h-6 w-32 mx-auto bg-white/20 rounded animate-pulse mb-2"></div>
                    <div className="h-10 w-64 mx-auto bg-white/20 rounded animate-pulse"></div>
                </div>
                
                {/* Question card */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 mb-6 animate-pulse">
                    <div className="space-y-3">
                        <div className="h-5 w-full bg-white/20 rounded"></div>
                        <div className="h-5 w-4/5 bg-white/20 rounded"></div>
                        <div className="h-5 w-3/4 bg-white/20 rounded"></div>
                    </div>
                </div>
                
                {/* Answer input */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 animate-pulse">
                    <div className="h-12 w-full bg-white/20 rounded mb-4"></div>
                    <div className="h-12 w-32 mx-auto bg-white/30 rounded"></div>
                </div>
            </div>
        </div>
    )
}

