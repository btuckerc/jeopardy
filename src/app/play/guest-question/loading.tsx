export default function GuestQuestionLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                {/* Category header */}
                <div className="text-center mb-8">
                    <div className="h-6 w-24 mx-auto bg-white/20 rounded animate-pulse mb-2"></div>
                    <div className="h-8 w-48 mx-auto bg-white/20 rounded animate-pulse"></div>
                </div>
                
                {/* Question card */}
                <div className="bg-blue-800/50 backdrop-blur-sm rounded-xl p-8 mb-6 animate-pulse">
                    <div className="space-y-3">
                        <div className="h-5 w-full bg-white/20 rounded"></div>
                        <div className="h-5 w-4/5 bg-white/20 rounded"></div>
                    </div>
                </div>
                
                {/* Answer section */}
                <div className="bg-blue-800/30 backdrop-blur-sm rounded-xl p-6 animate-pulse">
                    <div className="h-12 w-full bg-white/20 rounded mb-4"></div>
                    <div className="flex justify-center gap-4">
                        <div className="h-12 w-28 bg-white/30 rounded"></div>
                        <div className="h-12 w-28 bg-white/20 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}

