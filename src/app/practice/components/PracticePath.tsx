'use client'

import Link from 'next/link'

export default function PracticePath() {
    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-md border border-blue-100 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Choose Your Study Method</h2>
                    <p className="text-gray-600 text-sm">Pick the approach that works best for you</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                    href="/practice/category"
                    className="group p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-md transition-all"
                >
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">By Category</h3>
                            <p className="text-gray-600 text-sm mt-1">Focus on specific topics like Geography, Entertainment, or Science</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/practice/round"
                    className="group p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:shadow-md transition-all"
                >
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">By Round</h3>
                            <p className="text-gray-600 text-sm mt-1">Practice Single, Double, or Final Jeopardy rounds</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/practice/triple-stumpers"
                    className="group p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:shadow-md transition-all"
                >
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Triple Stumpers</h3>
                            <p className="text-gray-600 text-sm mt-1">Challenge yourself with the hardest questions</p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    )
}
