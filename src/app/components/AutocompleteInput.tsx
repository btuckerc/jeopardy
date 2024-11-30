'use client'

import { useState, useRef, useEffect } from 'react'
import { getSuggestions, shouldShowSuggestions } from '../lib/suggestions'

interface AutocompleteInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
    question: string
    answer: string
    disabled?: boolean
    placeholder?: string
}

export function AutocompleteInput({
    value,
    onChange,
    onSubmit,
    question,
    answer,
    disabled = false,
    placeholder = 'Your answer...'
}: AutocompleteInputProps) {
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const suggestionsRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (shouldShowSuggestions(value) && !disabled) {
            const newSuggestions = getSuggestions(value, question, answer)
            setSuggestions(newSuggestions)
            setShowSuggestions(newSuggestions.length > 0)
        } else {
            setShowSuggestions(false)
        }
        setSelectedIndex(-1)
    }, [value, question, answer, disabled])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev =>
                prev < suggestions.length - 1 ? prev + 1 : prev
            )
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => prev > -1 ? prev - 1 : -1)
        } else if (e.key === 'Enter') {
            if (selectedIndex > -1) {
                e.preventDefault()
                onChange(suggestions[selectedIndex])
                setShowSuggestions(false)
            } else {
                onSubmit()
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
        } else if (e.key === 'Tab' && selectedIndex > -1) {
            e.preventDefault()
            onChange(suggestions[selectedIndex])
            setShowSuggestions(false)
        }
    }

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (shouldShowSuggestions(value) && !disabled) {
                        setShowSuggestions(true)
                    }
                }}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
            />

            {showSuggestions && (
                <div
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
                >
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={suggestion}
                            className={`px-4 py-2 cursor-pointer ${index === selectedIndex
                                    ? 'bg-blue-100'
                                    : 'hover:bg-gray-100'
                                }`}
                            onClick={() => {
                                onChange(suggestion)
                                setShowSuggestions(false)
                                inputRef.current?.focus()
                            }}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
} 