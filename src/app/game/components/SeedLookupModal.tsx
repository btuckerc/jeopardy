'use client'

interface SeedLookupResult {
    seed: string
    label: string
    mode: string
    rounds: string[]
    createdBy: string
}

interface SeedLookupModalProps {
    isOpen: boolean
    result: SeedLookupResult | null
    error: string | null
    isLoading: boolean
    isStarting: boolean
    onClose: () => void
    onStart: () => void
}

export default function SeedLookupModal({
    isOpen,
    result,
    error,
    isLoading,
    isStarting,
    onClose,
    onStart
}: SeedLookupModalProps) {
    if (!isOpen || !result) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Play Shared Game</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Game Info */}
                    <div className="bg-blue-50 rounded-lg p-4">
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{result.label}</h3>
                        <div className="space-y-1 text-sm text-gray-600">
                            <p>
                                <span className="font-medium">Mode:</span>{' '}
                                {result.mode === 'random' ? 'Random' :
                                 result.mode === 'knowledge' ? 'Knowledge Areas' :
                                 result.mode === 'custom' ? 'Custom Categories' :
                                 result.mode === 'date' ? 'By Air Date' : result.mode}
                            </p>
                            <p>
                                <span className="font-medium">Rounds:</span>{' '}
                                {result.rounds.join(', ')}
                            </p>
                            <p>
                                <span className="font-medium">Shared by:</span>{' '}
                                {result.createdBy}
                            </p>
                        </div>
                    </div>

                    {/* Seed Display */}
                    <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Seed:</span>
                        <code className="flex-1 font-mono text-sm text-gray-800">{result.seed}</code>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onStart}
                            disabled={isStarting}
                            className={`flex-1 btn-primary ${isStarting ? 'opacity-50 cursor-wait' : ''}`}
                        >
                            {isStarting ? 'Starting...' : 'Start Game'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

