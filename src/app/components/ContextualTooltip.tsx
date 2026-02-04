'use client'

import { useState, useRef, useEffect } from 'react'

interface ContextualTooltipProps {
    children: React.ReactNode
    content: string
    position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function ContextualTooltip({ 
    children, 
    content, 
    position = 'top' 
}: ContextualTooltipProps) {
    const [isVisible, setIsVisible] = useState(false)
    const triggerRef = useRef<HTMLDivElement>(null)
    
    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    }
    
    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l-transparent border-r-transparent border-b-transparent',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l-transparent border-r-transparent border-t-transparent',
        left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t-transparent border-b-transparent border-r-transparent',
        right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-t-transparent border-b-transparent border-l-transparent'
    }

    return (
        <div 
            ref={triggerRef}
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
        >
            {children}
            
            {isVisible && (
                <div className={`absolute ${positionClasses[position]} z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap max-w-xs`}>
                    {content}
                    <div className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${arrowClasses[position]}`} style={{ borderWidth: '4px' }} />
                </div>
            )}
        </div>
    )
}
