export default function GameBoardLoading() {
    return (
        <div className="flex-1 w-full flex items-center justify-center bg-slate-100 py-16">
            <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4" />
                <div className="text-slate-600 font-medium">Loading game...</div>
            </div>
        </div>
    )
}
