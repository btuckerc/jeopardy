'use client'

import { useState, useEffect, useMemo } from 'react'
import { Combobox } from '@headlessui/react'
import { CheckIcon } from '@heroicons/react/20/solid'

interface Category {
    id: string
    name: string
    airDate?: Date
    isDoubleJeopardy: boolean
    _count?: {
        questions: number
    }
}

interface ComboboxRenderPropArg {
    active: boolean
    disabled: boolean
    selected: boolean
}

interface CustomCategoryPickerProps {
    selectedCategories: Category[]
    onCategoriesChange: (categories: Category[]) => void
    maxCategories?: number
}

export default function CustomCategoryPicker({ 
    selectedCategories, 
    onCategoriesChange,
    maxCategories = 5 
}: CustomCategoryPickerProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [availableCategories, setAvailableCategories] = useState<Category[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Debounced search for categories
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setAvailableCategories([])
            return
        }

        const timer = setTimeout(async () => {
            setIsSearching(true)
            try {
                const response = await fetch(`/api/categories/search?q=${encodeURIComponent(searchQuery)}`)
                if (!response.ok) throw new Error('Failed to search categories')
                const data = await response.json()
                setAvailableCategories(data.filter((cat: Category) => !cat.isDoubleJeopardy))
            } catch (error) {
                console.error('Error searching categories:', error)
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery])

    const filteredCategories = useMemo(() =>
        searchQuery === ''
            ? availableCategories
            : availableCategories.filter((category) =>
                category.name.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        [searchQuery, availableCategories]
    )

    const handleCategorySelect = (category: Category | null) => {
        if (!category) return
        if (selectedCategories.some(c => c.id === category.id)) {
            onCategoriesChange(selectedCategories.filter(c => c.id !== category.id))
        } else if (selectedCategories.length < maxCategories) {
            onCategoriesChange([...selectedCategories, category])
        }
        setSearchQuery('')
    }

    return (
        <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Categories (up to {maxCategories})
            </label>
            <Combobox
                value={null}
                onChange={handleCategorySelect}
            >
                <div className="relative">
                    <Combobox.Input
                        className="w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                        displayValue={() => ''}
                        placeholder="Type to search categories..."
                    />
                    <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 shadow-lg border border-gray-200">
                        {isSearching ? (
                            <div className="px-4 py-2 text-sm text-gray-500">Searching...</div>
                        ) : searchQuery.length < 2 ? (
                            <div className="px-4 py-2 text-sm text-gray-500">Type at least 2 characters...</div>
                        ) : filteredCategories.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-gray-500">No categories found</div>
                        ) : (
                            filteredCategories.map((category) => {
                                const isSelected = selectedCategories.some(c => c.id === category.id)
                                const isDisabled = selectedCategories.length >= maxCategories && !isSelected
                                return (
                                    <Combobox.Option
                                        key={category.id}
                                        value={category}
                                        disabled={isDisabled}
                                        className={({ active, disabled }: ComboboxRenderPropArg) =>
                                            `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
                                        }
                                    >
                                        {({ active }: { active: boolean }) => (
                                            <>
                                                <span className={`block truncate ${isSelected ? 'font-medium' : 'font-normal'}`}>
                                                    {category.name}
                                                    {category._count && ` (${category._count.questions} questions)`}
                                                </span>
                                                {isSelected && (
                                                    <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-blue-600'}`}>
                                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </Combobox.Option>
                                )
                            })
                        )}
                    </Combobox.Options>
                </div>
            </Combobox>
            {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                    {selectedCategories.map((category) => (
                        <span
                            key={category.id}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                        >
                            {category.name}
                            <button
                                type="button"
                                onClick={() => onCategoriesChange(selectedCategories.filter(c => c.id !== category.id))}
                                className="ml-2 inline-flex items-center p-0.5 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

