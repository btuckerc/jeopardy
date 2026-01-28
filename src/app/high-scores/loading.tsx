export default function Loading() {
    return (
        <div className="container mx-auto px-3 py-5 md:px-4 md:py-8">
            {/* Header Skeleton */}
            <div className="page-header mb-5 md:mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                    <div className="flex-1">
                        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mb-2"></div>
                        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
                        <div className="h-5 w-64 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="stat-card w-full md:w-[200px] bg-gray-50 animate-pulse">
                        <div className="h-3 w-20 bg-gray-200 rounded mb-2 mx-auto"></div>
                        <div className="h-8 w-24 bg-gray-200 rounded mb-2 mx-auto"></div>
                        <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
                    </div>
                </div>
            </div>

            {/* Filter Skeleton */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 w-20 bg-gray-200 rounded-full animate-pulse"></div>
                    ))}
                </div>
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>

            {/* Mobile Cards Skeleton */}
            <ul className="md:hidden space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <li key={i} className="card p-3 animate-pulse">
                        <div className="flex items-center justify-between mb-2">
                            <div className="h-5 w-12 bg-gray-200 rounded"></div>
                            <div className="h-6 w-20 bg-gray-200 rounded"></div>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                            <div className="h-5 w-32 bg-gray-200 rounded"></div>
                        </div>
                        <div className="flex gap-4">
                            <div className="h-4 w-20 bg-gray-200 rounded"></div>
                            <div className="h-4 w-16 bg-gray-200 rounded"></div>
                        </div>
                    </li>
                ))}
            </ul>

            {/* Desktop Table Skeleton */}
            <div className="hidden md:block card overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            {['Rank', 'Player', 'Score', 'Mode', 'Questions', 'Accuracy', 'Date'].map((header) => (
                                <th key={header} className="px-4 lg:px-6 py-3 text-left">
                                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                <td className="px-4 lg:px-6 py-3">
                                    <div className="h-5 w-8 bg-gray-200 rounded animate-pulse"></div>
                                </td>
                                <td className="px-4 lg:px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                                        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                </td>
                                <td className="px-4 lg:px-6 py-3">
                                    <div className="h-5 w-16 bg-gray-200 rounded animate-pulse ml-auto"></div>
                                </td>
                                <td className="px-4 lg:px-6 py-3">
                                    <div className="h-5 w-20 bg-gray-200 rounded animate-pulse"></div>
                                </td>
                                <td className="px-4 lg:px-6 py-3">
                                    <div className="h-5 w-12 bg-gray-200 rounded animate-pulse ml-auto"></div>
                                </td>
                                <td className="px-4 lg:px-6 py-3">
                                    <div className="h-5 w-10 bg-gray-200 rounded animate-pulse ml-auto"></div>
                                </td>
                                <td className="px-4 lg:px-6 py-3">
                                    <div className="h-5 w-16 bg-gray-200 rounded animate-pulse"></div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
