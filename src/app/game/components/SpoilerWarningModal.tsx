'use client'

interface SpoilerSettings {
    enabled: boolean
    cutoffDate: Date | null
}

interface SpoilerWarningModalProps {
    isOpen: boolean
    spoilerSettings: SpoilerSettings | null
    conflictDate: string | null
    gameConfigDate?: string
    updatingSpoilerDate: boolean
    onClose: () => void
    onProceed: () => void
    onUpdateSpoilerDate: (newDate: Date) => void
}

export default function SpoilerWarningModal({
    isOpen,
    spoilerSettings,
    conflictDate,
    gameConfigDate,
    updatingSpoilerDate,
    onClose,
    onProceed,
    onUpdateSpoilerDate
}: SpoilerWarningModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl">
                <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Spoiler Warning</h2>
                        <p className="text-sm text-gray-500 mt-1">This game may include questions you haven&apos;t seen yet</p>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <p className="text-gray-800">
                        Based on your spoiler settings, this game might include questions which spoil up to{' '}
                        <strong>{conflictDate}</strong>.
                    </p>
                    {spoilerSettings?.cutoffDate && (
                        <p className="text-gray-600 text-sm mt-2">
                            Your current spoiler protection blocks episodes from{' '}
                            <strong>
                                {spoilerSettings.cutoffDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </strong>{' '}
                            and later.
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">What would you like to do?</p>

                    {/* Option 1: Update spoiler date */}
                    {gameConfigDate && (
                        <button
                            onClick={() => {
                                // Set the new cutoff to the day after the episode date
                                const episodeDate = new Date(gameConfigDate)
                                const newCutoff = new Date(episodeDate)
                                newCutoff.setDate(newCutoff.getDate() + 1)
                                onUpdateSpoilerDate(newCutoff)
                            }}
                            disabled={updatingSpoilerDate}
                            className="w-full p-3 text-left rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">Update my spoiler date</p>
                                    <p className="text-sm text-gray-500">
                                        Change your cutoff to include this episode ({conflictDate})
                                    </p>
                                </div>
                            </div>
                        </button>
                    )}

                    {/* Option 2: Proceed anyway */}
                    <button
                        onClick={onProceed}
                        disabled={updatingSpoilerDate}
                        className="w-full p-3 text-left rounded-lg border border-gray-200 hover:border-amber-500 hover:bg-amber-50 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center group-hover:bg-amber-200">
                                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">Proceed anyway for this game</p>
                                <p className="text-sm text-gray-500">
                                    Start the game without changing your spoiler settings
                                </p>
                            </div>
                        </div>
                    </button>

                    {/* Option 3: Choose a custom date */}
                    <div className="p-3 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">Choose a different cutoff date</p>
                                <p className="text-sm text-gray-500">
                                    Set a custom date for your spoiler protection
                                </p>
                            </div>
                        </div>
                        <div className="pl-11">
                            <input
                                type="date"
                                value={spoilerSettings?.cutoffDate ? spoilerSettings.cutoffDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const newDate = new Date(e.target.value)
                                        // Add one day to make it the cutoff (show episodes before this date)
                                        newDate.setDate(newDate.getDate() + 1)
                                        onUpdateSpoilerDate(newDate)
                                    }
                                }}
                                disabled={updatingSpoilerDate}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 text-gray-900 text-sm transition-all duration-200"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Episodes aired before this date will be available
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        disabled={updatingSpoilerDate}
                        className="w-full btn-secondary"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

