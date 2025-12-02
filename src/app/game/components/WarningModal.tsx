'use client'

import { useState, useEffect } from 'react'

interface Category {
    id: string
    name: string
    airDate?: Date
    isDoubleJeopardy: boolean
    _count?: {
        questions: number
    }
}

interface WarningModalProps {
    isOpen: boolean
    mode: 'custom' | 'knowledge'
    customCategories: Category[]
    knowledgeCategoriesCount: number
    availableCategoriesForFill: Category[]
    isLoadingFillCategories: boolean
    onClose: () => void
    onConfirm: () => void
    onAddRandom: () => void
    onAddCategory: (category: Category) => void
}

export default function WarningModal({
    isOpen,
    mode,
    customCategories,
    knowledgeCategoriesCount,
    availableCategoriesForFill,
    isLoadingFillCategories,
    onClose,
    onConfirm,
    onAddRandom,
    onAddCategory
}: WarningModalProps) {
    const [fillCategorySearchQuery, setFillCategorySearchQuery] = useState('')

    // Reset search when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFillCategorySearchQuery('')
        }
    }, [isOpen])

    if (!isOpen) return null

    const categoryCount = mode === 'custom' ? customCategories.length : knowledgeCategoriesCount
    const categoryLabel = mode === 'custom' ? 'categor' + (categoryCount === 1 ? 'y' : 'ies') : 'knowledge area' + (knowledgeCategoriesCount !== 1 ? 's' : '')

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                <h2 className="text-2xl font-bold mb-4 text-gray-900">Insufficient Categories</h2>
                <p className="text-gray-700 mb-6">
                    You have selected <strong>{categoryCount}</strong> {categoryLabel} but a full game typically requires 5 categories per round. This may result in a partial game board.
                </p>
                
                {mode === 'custom' && availableCategoriesForFill.length > 0 && customCategories.length < 5 && (
                    <div className="border rounded-lg p-4 mb-4">
                        <h3 className="font-medium mb-2 text-gray-900">Add Random Categories</h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Automatically add {5 - customCategories.length} random category{5 - customCategories.length !== 1 ? 'ies' : ''} to fill the board.
                        </p>
                        <button
                            onClick={onAddRandom}
                            className="btn-primary btn-sm"
                        >
                            Add Random Categories
                        </button>
                    </div>
                )}

                {mode === 'custom' && customCategories.length < 5 && (
                    <div className="border rounded-lg p-4 mb-4">
                        <h3 className="font-medium mb-2 text-gray-900">Select Additional Categories</h3>
                        <input
                            type="text"
                            value={fillCategorySearchQuery}
                            onChange={(e) => setFillCategorySearchQuery(e.target.value)}
                            className="w-full p-2 border rounded-lg mb-3 text-gray-900"
                            placeholder="Search categories..."
                        />
                        {isLoadingFillCategories ? (
                            <div className="text-gray-500">Loading...</div>
                        ) : (
                            <div className="max-h-48 overflow-y-auto space-y-2">
                                {availableCategoriesForFill
                                    .filter(cat => 
                                        fillCategorySearchQuery === '' ||
                                        cat.name.toLowerCase().includes(fillCategorySearchQuery.toLowerCase())
                                    )
                                    .slice(0, 20)
                                    .map((category) => (
                                        <button
                                            key={category.id}
                                            onClick={() => onAddCategory(category)}
                                            disabled={customCategories.length >= 5 || customCategories.some(c => c.id === category.id)}
                                            className={`w-full text-left p-2 rounded text-sm ${
                                                customCategories.some(c => c.id === category.id)
                                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                    : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                                            }`}
                                        >
                                            {category.name} ({category._count?.questions || 0} questions)
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="btn-primary"
                    >
                        Start Anyway
                    </button>
                </div>
            </div>
        </div>
    )
}

