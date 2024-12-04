'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Combobox } from '@headlessui/react'
import { CheckIcon } from '@heroicons/react/20/solid'
import type { ElementType } from 'react'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"

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

// Create a custom Combobox component that supports multiple selection
const MultiCombobox = Combobox as unknown as (props: {
    value: Category[]
    onChange: (value: Category[]) => void
    children: React.ReactNode
}) => JSX.Element

const KNOWLEDGE_CATEGORIES = [
    'GEOGRAPHY_AND_HISTORY',
    'ENTERTAINMENT',
    'ARTS_AND_LITERATURE',
    'SCIENCE_AND_NATURE',
    'SPORTS_AND_LEISURE',
    'GENERAL_KNOWLEDGE'
] as const

type KnowledgeCategory = typeof KNOWLEDGE_CATEGORIES[number]

export default function GameModePage() {
    const router = useRouter()
    const [selectedMode, setSelectedMode] = useState<'random' | 'knowledge' | 'custom' | 'date'>('random')
    const [selectedCategories, setSelectedCategories] = useState<KnowledgeCategory[]>([])
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null)
    const [availableCategories, setAvailableCategories] = useState<Category[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [customCategories, setCustomCategories] = useState<Category[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [availableDates, setAvailableDates] = useState<string[]>([])
    const [isLoadingDates, setIsLoadingDates] = useState(false)

    // Convert available dates to Date objects for easier comparison
    const availableDateObjects = useMemo(() =>
        availableDates.map(date => new Date(date)),
        [availableDates]
    )

    // Get array of years that have episodes and min/max years
    const { availableYears, minYear, maxYear } = useMemo(() => {
        if (availableDates.length === 0) {
            return { availableYears: [], minYear: new Date().getFullYear(), maxYear: new Date().getFullYear() }
        }
        const years = availableDates.map(date => new Date(date).getFullYear())
        const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a) // Sort descending
        return {
            availableYears: uniqueYears,
            minYear: Math.min(...uniqueYears),
            maxYear: Math.max(...uniqueYears)
        }
    }, [availableDates])

    // Handle date changes from the date picker
    const handleDateChange = (date: Date | null) => {
        setSelectedDateObj(date)
        setSelectedDate(date ? date.toISOString().split('T')[0] : '')
    }

    // Function to determine if a date should be enabled
    const isDateAvailable = (date: Date) => {
        return availableDateObjects.some(availableDate =>
            availableDate.toISOString().split('T')[0] === date.toISOString().split('T')[0]
        )
    }

    // Custom year content to gray out invalid years
    const renderYearContent = (year: number) => {
        const hasEpisodes = availableYears.includes(year)
        return (
            <span className={!hasEpisodes ? 'text-gray-300' : undefined}>
                {year}
            </span>
        )
    }

    useEffect(() => {
        const fetchAvailableDates = async () => {
            setIsLoadingDates(true)
            try {
                const response = await fetch('/api/game/available-dates')
                const data = await response.json()
                if (data.dates) {
                    setAvailableDates(data.dates)
                }
            } catch (error) {
                console.error('Error fetching available dates:', error)
            }
            setIsLoadingDates(false)
        }

        fetchAvailableDates()
    }, [])

    // Debounced search for categories
    useEffect(() => {
        if (selectedMode !== 'custom' || !searchQuery || searchQuery.length < 2) {
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
    }, [searchQuery, selectedMode])

    // Compute filtered categories based on search query
    const filteredCategories = useMemo(() =>
        searchQuery === ''
            ? availableCategories
            : availableCategories.filter((category) =>
                category.name.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        [searchQuery, availableCategories]
    )

    const handleStartGame = async () => {
        let gameConfig;

        switch (selectedMode) {
            case 'random':
                gameConfig = { mode: 'random' }
                break
            case 'knowledge':
                if (selectedCategories.length === 0) {
                    alert('Please select at least one knowledge category')
                    return
                }
                gameConfig = {
                    mode: 'knowledge',
                    categories: selectedCategories
                }
                break
            case 'custom':
                if (customCategories.length !== 5) {
                    alert('Please select exactly 5 categories')
                    return
                }
                gameConfig = {
                    mode: 'custom',
                    categoryIds: customCategories.map(c => c.id)
                }
                break
            case 'date':
                if (!selectedDate) {
                    alert('Please select a date')
                    return
                }
                gameConfig = {
                    mode: 'date',
                    date: selectedDate
                }
                break
        }

        // Store game configuration and redirect to game board
        localStorage.setItem('gameConfig', JSON.stringify(gameConfig))
        router.push('/game/board')
    }

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">Select Game Mode</h1>

                <div className="bg-white shadow rounded-lg p-6 space-y-6">
                    <div className="space-y-4">
                        {/* Mode Selection */}
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <button
                                onClick={() => setSelectedMode('random')}
                                className={`p-4 rounded-lg text-center ${selectedMode === 'random'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                            >
                                Random Categories
                            </button>
                            <button
                                onClick={() => setSelectedMode('knowledge')}
                                className={`p-4 rounded-lg text-center ${selectedMode === 'knowledge'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                            >
                                Knowledge Areas
                            </button>
                            <button
                                onClick={() => setSelectedMode('custom')}
                                className={`p-4 rounded-lg text-center ${selectedMode === 'custom'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                            >
                                Custom Categories
                            </button>
                            <button
                                onClick={() => setSelectedMode('date')}
                                className={`p-4 rounded-lg text-center ${selectedMode === 'date'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                    }`}
                            >
                                By Air Date
                            </button>
                        </div>

                        {/* Mode-specific options */}
                        {selectedMode === 'knowledge' && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Select Knowledge Categories</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {KNOWLEDGE_CATEGORIES.map((category) => (
                                        <label key={category} className="flex items-center space-x-2 text-gray-900">
                                            <input
                                                type="checkbox"
                                                checked={selectedCategories.includes(category)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedCategories([...selectedCategories, category])
                                                    } else {
                                                        setSelectedCategories(selectedCategories.filter(c => c !== category))
                                                    }
                                                }}
                                                className="rounded border-gray-300"
                                            />
                                            <span>{category.replace(/_/g, ' ')}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedMode === 'custom' && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Select 5 Categories</h3>
                                <MultiCombobox
                                    value={customCategories}
                                    onChange={setCustomCategories}
                                >
                                    <div className="relative">
                                        <Combobox.Input
                                            className="w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 placeholder-gray-500"
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                                            displayValue={(categories: Category[]) =>
                                                categories?.map(c => c.name).join(', ') || ''
                                            }
                                            placeholder="Type to search categories..."
                                        />
                                        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg">
                                            {isSearching ? (
                                                <div className="px-4 py-2 text-sm text-gray-500">Searching...</div>
                                            ) : searchQuery.length < 2 ? (
                                                <div className="px-4 py-2 text-sm text-gray-500">Type at least 2 characters to search...</div>
                                            ) : filteredCategories.length === 0 ? (
                                                <div className="px-4 py-2 text-sm text-gray-500">No categories found</div>
                                            ) : (
                                                            filteredCategories.map((category) => (
                                                                <Combobox.Option
                                                                    key={category.id}
                                                                    value={category}
                                                                    disabled={customCategories.length >= 5 && !customCategories.includes(category)}
                                                                    className={({ active, disabled }: ComboboxRenderPropArg) =>
                                                                        `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                                                        } ${disabled ? 'opacity-50' : ''}`
                                                                    }
                                                                >
                                                                    {({ selected }: { selected: boolean }) => (
                                                                        <>
                                                                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                                                {category.name}
                                                                                {category._count && ` (${category._count.questions} questions)`}
                                                                            </span>
                                                                            {selected && (
                                                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                                                                    <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                                                </span>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </Combobox.Option>
                                                            ))
                                            )}
                                        </Combobox.Options>
                                    </div>
                                </MultiCombobox>
                                {Array.isArray(customCategories) && customCategories.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {customCategories.map((category) => (
                                            <span
                                                key={category.id}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                                            >
                                                {category.name}
                                                <button
                                                    type="button"
                                                    onClick={() => setCustomCategories(customCategories.filter(c => c.id !== category.id))}
                                                    className="ml-2 inline-flex items-center p-0.5 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedMode === 'date' && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Select Air Date</h3>
                                {isLoadingDates ? (
                                    <div className="text-gray-500">Loading available dates...</div>
                                ) : availableDates.length === 0 ? (
                                    <div className="text-gray-500">No dates available</div>
                                ) : (
                                    <div className="relative">
                                        <DatePicker
                                            selected={selectedDateObj}
                                            onChange={handleDateChange}
                                            filterDate={isDateAvailable}
                                            dateFormat="MMMM d, yyyy"
                                            placeholderText="Select an air date"
                                            className="w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900"
                                            calendarClassName="bg-white shadow-lg rounded-lg border border-gray-200"
                                            showMonthDropdown
                                            showYearDropdown
                                            dropdownMode="select"
                                            minDate={new Date(minYear, 0, 1)}
                                            maxDate={new Date(maxYear, 11, 31)}
                                            renderYearContent={renderYearContent}
                                            yearDropdownItemNumber={maxYear - minYear + 1}
                                            scrollableYearDropdown
                                            isClearable
                                        />
                                        {selectedDate && (
                                            <div className="mt-2 text-sm text-gray-500">
                                                Selected episode from {new Date(selectedDate).toLocaleDateString('en-US', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                                    </div>
                                                )}
                                            </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleStartGame}
                            className={`px-6 py-2 rounded-lg transition-colors ${(selectedMode === 'knowledge' && selectedCategories.length === 0) ||
                                (selectedMode === 'custom' && customCategories.length !== 5) ||
                                (selectedMode === 'date' && !selectedDate)
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            disabled={
                                (selectedMode === 'knowledge' && selectedCategories.length === 0) ||
                                (selectedMode === 'custom' && customCategories.length !== 5) ||
                                (selectedMode === 'date' && !selectedDate)
                            }
                        >
                            Start Game
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
} 