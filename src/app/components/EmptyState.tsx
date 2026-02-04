import Link from 'next/link'

interface EmptyStateProps {
    title: string
    description: string
    icon?: React.ReactNode
    action?: {
        label: string
        href: string
    }
    secondaryAction?: {
        label: string
        href: string
    }
}

export default function EmptyState({ 
    title, 
    description, 
    icon,
    action,
    secondaryAction 
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            {/* Icon */}
            {icon && (
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    {icon}
                </div>
            )}
            
            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 mb-2">
                {title}
            </h3>
            
            {/* Description */}
            <p className="text-gray-600 max-w-md mb-6">
                {description}
            </p>
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                {action && (
                    <Link
                        href={action.href}
                        className="btn-primary"
                    >
                        {action.label}
                    </Link>
                )}
                {secondaryAction && (
                    <Link
                        href={secondaryAction.href}
                        className="btn-secondary"
                    >
                        {secondaryAction.label}
                    </Link>
                )}
            </div>
        </div>
    )
}
