export default function GameBoardLoading() {
    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                <div className="text-gray-600 font-medium">Loading game...</div>
            </div>
        </div>
    )
}

