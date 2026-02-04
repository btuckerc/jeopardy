'use client'

interface TourTooltipProps {
    title: string
    description: string
    step: number
    totalSteps: number
    onNext: () => void
    onSkip: () => void
    isSplash?: boolean
}

export default function TourTooltip({
    title,
    description,
    step,
    totalSteps,
    onNext,
    onSkip,
    isSplash = false
}: TourTooltipProps) {
    const isLastStep = step === totalSteps - 1
    
    return (
        <div className="w-full bg-white rounded-xl shadow-2xl border border-gray-200 p-6 animate-fade-in-up relative">
            {/* Progress indicator - hidden for splash */}
            {!isSplash && (
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                        {Array.from({ length: totalSteps - 1 }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                    i < step ? 'bg-amber-400' : 'bg-gray-300'
                                }`}
                            />
                        ))}
                    </div>
                    <span className="text-sm text-gray-500">
                        Step {step} of {totalSteps - 1}
                    </span>
                </div>
            )}
            
            {/* Content */}
            <h3 className="text-xl font-bold text-gray-900 mb-3">
                {title}
            </h3>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {description}
            </p>
            
            {/* Actions */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onSkip}
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                >
                    {isSplash ? 'Skip Tour' : 'Skip'}
                </button>
                <button
                    onClick={onNext}
                    className="bg-amber-400 hover:bg-amber-500 text-blue-900 px-6 py-2.5 rounded-lg font-bold text-sm transition-colors"
                >
                    {isSplash ? 'Start Tour →' : isLastStep ? 'Finish' : 'Next →'}
                </button>
            </div>
            
            {/* Arrow - only for non-splash */}
            {!isSplash && (
                <div 
                    className="absolute w-4 h-4 bg-white border-gray-200 transform rotate-45 -top-2 left-1/2 -translate-x-1/2 border-t border-l"
                />
            )}
        </div>
    )
}
