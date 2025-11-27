import Link from 'next/link'
import { Fredoka } from 'next/font/google'
import { getAppUser } from '@/lib/clerk-auth'

const fredoka = Fredoka({ weight: '300', subsets: ['latin'] })

export default async function Home() {
    // Fetch user on the server - no flash, immediate render
    const user = await getAppUser()

    return (
        <div className="min-h-screen flex flex-col">
            {/* Hero Section */}
            <main className="flex-1">
                <div className="relative overflow-hidden">
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-amber-50 -z-10" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent -z-10" />
                    
                    <div className="container mx-auto px-4 py-16 sm:py-24">
                        {/* Header */}
                        <div className="text-center max-w-4xl mx-auto">
                            <h1>
                                <span className="text-4xl font-extrabold text-gray-900 sm:text-5xl lg:text-6xl block tracking-tight">
                                    Master Trivia with
                                </span>
                                <span className={`${fredoka.className} text-5xl sm:text-6xl lg:text-7xl bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent block mt-3`}>
                                    trivrdy
                                </span>
                            </h1>
                            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-600 leading-relaxed">
                                Train with authentic Jeopardy questions. Track your progress. 
                                Compete on the leaderboard. Become a trivia champion.
                            </p>
                            
                            {/* Quick stats */}
                            <div className="mt-8 flex justify-center gap-8 text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>12,000+ Questions</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                    <span>6 Knowledge Categories</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    <span>Track Progress</span>
                                </div>
                            </div>
                        </div>

                        {/* Mode Cards */}
                        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 max-w-4xl mx-auto">
                            {/* Game Mode */}
                            <Link href="/game" className="group">
                                <div className="relative h-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-2">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800" />
                                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                                    <div className="relative p-8 h-full flex flex-col">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-white/20 rounded-lg">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <h2 className="text-2xl font-bold text-white">Game Mode</h2>
                                        </div>
                                        <p className="text-blue-100 flex-grow">
                                            Experience a complete Jeopardy simulation with authentic categories, 
                                            varying difficulty levels, and competitive scoring.
                                        </p>
                                        <div className="mt-6 flex items-center text-white font-medium group-hover:gap-3 gap-2 transition-all">
                                            <span>Start Playing</span>
                                            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </Link>

                            {/* Practice Mode */}
                            <Link href="/practice" className="group">
                                <div className="relative h-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-2">
                                    <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-green-800" />
                                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                                    <div className="relative p-8 h-full flex flex-col">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-white/20 rounded-lg">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                            </div>
                                            <h2 className="text-2xl font-bold text-white">Practice Mode</h2>
                                        </div>
                                        <p className="text-green-100 flex-grow">
                                            Study at your own pace with our comprehensive flashcard system. 
                                            Focus on specific categories and track your progress.
                                        </p>
                                        <div className="mt-6 flex items-center text-white font-medium group-hover:gap-3 gap-2 transition-all">
                                            <span>Start Practicing</span>
                                            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </div>

                        {/* Conditional content based on auth - server rendered, no flash */}
                        <div className="mt-16 text-center">
                            {!user ? (
                                <>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium mb-4">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Unlock all features
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900">Track Your Progress</h2>
                                    <p className="mt-3 max-w-xl mx-auto text-gray-600">
                                        Sign in to save your progress, compete on the leaderboard, and get 
                                        personalized recommendations based on your performance.
                                    </p>
                                    <Link 
                                        href="/sign-in"
                                        className="mt-6 inline-flex items-center gap-2 btn-primary btn-lg"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                        </svg>
                                        Sign In
                                    </Link>
                                </>
                            ) : (
                                <div className="flex justify-center gap-4">
                                    <Link href="/stats" className="btn-secondary">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        View Stats
                                    </Link>
                                    <Link href="/leaderboard" className="btn-secondary">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                        </svg>
                                        Leaderboard
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="border-t border-gray-200 bg-gray-50">
                    <div className="container mx-auto px-4 py-8">
                        <p className="text-center text-gray-500 text-sm">
                            Trivrdy is a Jeopardy study tool created by{' '}
                            <a 
                                href="https://tuckercraig.com" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Tucker Craig
                            </a>
                            . Practice with real questions, compete with others, and improve your trivia knowledge.
                        </p>
                    </div>
                </footer>
            </main>
        </div>
    )
}
