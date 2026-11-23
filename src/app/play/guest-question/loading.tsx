export default function GuestQuestionLoading() {
    return (
        <div className="flex-1 w-full bg-gradient-to-b from-emerald-50 to-white py-6 sm:py-10 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8 space-y-2">
                    <div className="h-9 w-52 mx-auto bg-emerald-200/70 rounded-lg animate-pulse" />
                    <div className="h-5 w-48 mx-auto bg-emerald-100 rounded animate-pulse" />
                </div>
                <div className="card p-8 space-y-5 animate-pulse">
                    <div className="h-7 w-40 bg-emerald-100 rounded-full" />
                    <div className="space-y-3">
                        <div className="h-6 w-full bg-slate-200 rounded" />
                        <div className="h-6 w-4/5 bg-slate-200 rounded" />
                    </div>
                    <div className="h-12 w-full bg-slate-100 rounded-xl" />
                </div>
            </div>
        </div>
    )
}
