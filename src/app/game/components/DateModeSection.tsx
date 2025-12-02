'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import DatePicker to reduce initial bundle size
// Cast the import function to work around TypeScript type incompatibility with react-datepicker's defaultProps
const DatePicker = dynamic(
    () => import('react-datepicker') as Promise<{ default: React.ComponentType<any> }>,
    { 
        ssr: false,
        loading: () => <div className="text-gray-500">Loading date picker...</div>
    }
)

// Import CSS separately - this needs to be imported normally for CSS to work
import "react-datepicker/dist/react-datepicker.css"

interface DateModeSectionProps {
    selectedDate: string
    selectedDateObj: Date | null
    onDateChange: (date: Date | null) => void
}

export default function DateModeSection({ 
    selectedDate, 
    selectedDateObj, 
    onDateChange 
}: DateModeSectionProps) {
    const [availableDates, setAvailableDates] = useState<string[]>([])
    const [isLoadingDates, setIsLoadingDates] = useState(false)

    // Only fetch dates when this component mounts (when date mode is selected)
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

    const availableDateObjects = useMemo(() =>
        availableDates.map(date => new Date(date)),
        [availableDates]
    )

    const { availableYears, minYear, maxYear } = useMemo(() => {
        if (availableDates.length === 0) {
            return { availableYears: [], minYear: new Date().getFullYear(), maxYear: new Date().getFullYear() }
        }
        const years = availableDates.map(date => new Date(date).getFullYear())
        const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a)
        return {
            availableYears: uniqueYears,
            minYear: Math.min(...uniqueYears),
            maxYear: Math.max(...uniqueYears)
        }
    }, [availableDates])

    const isDateAvailable = (date: Date) => {
        return availableDateObjects.some(availableDate =>
            availableDate.toISOString().split('T')[0] === date.toISOString().split('T')[0]
        )
    }

    const renderYearContent = (year: number) => {
        const hasEpisodes = availableYears.includes(year)
        return (
            <span className={!hasEpisodes ? 'text-gray-300' : undefined}>
                {year}
            </span>
        )
    }

    return (
        <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Air Date</label>
            {isLoadingDates ? (
                <div className="text-gray-500">Loading available dates...</div>
            ) : availableDates.length === 0 ? (
                <div className="text-gray-500">No dates available</div>
            ) : (
                <DatePicker
                    selected={selectedDateObj}
                    onChange={onDateChange}
                    filterDate={isDateAvailable}
                    dateFormat="MMMM d, yyyy"
                    placeholderText="Select an air date"
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            )}
        </div>
    )
}

