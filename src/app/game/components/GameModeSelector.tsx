'use client'

interface GameModeSelectorProps {
    selectedMode: 'random' | 'knowledge' | 'custom' | 'date'
    onModeChange: (mode: 'random' | 'knowledge' | 'custom' | 'date') => void
}

export default function GameModeSelector({ selectedMode, onModeChange }: GameModeSelectorProps) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Game Mode</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                    onClick={() => onModeChange('date')}
                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all ${selectedMode === 'date'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                >
                    By Air Date
                </button>
                <button
                    onClick={() => onModeChange('random')}
                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all ${selectedMode === 'random'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                >
                    Random
                </button>
                <button
                    onClick={() => onModeChange('knowledge')}
                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all ${selectedMode === 'knowledge'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                >
                    Knowledge Areas
                </button>
                <button
                    onClick={() => onModeChange('custom')}
                    className={`p-3 rounded-lg text-center text-sm font-medium transition-all ${selectedMode === 'custom'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                >
                    Custom
                </button>
            </div>
        </div>
    )
}

