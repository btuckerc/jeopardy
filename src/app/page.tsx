'use client'

import Link from 'next/link'
import { useAuth } from './lib/auth'
import { Fredoka } from 'next/font/google'

const fredoka = Fredoka({ weight: '300', subsets: ['latin'] })

export default function Home() {
    const { user, loading } = useAuth()

    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 container mx-auto px-4 flex flex-col justify-between py-6">
                <div className="flex flex-col space-y-8">
                    <div className="text-center">
                        <h1>
                            <span className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl block">
                                Study Jeopardy Online with{' '}
                            </span>
                            <span className={`${fredoka.className} text-5xl sm:text-6xl lg:text-7xl text-blue-600 block mt-4`}>
                                trivrdy
                            </span>
                        </h1>
                        <p className="mt-8 max-w-2xl mx-auto text-xl text-gray-500">
                            Practice your trivia skills with our Jeopardy-style learning app. Choose between game mode for a full game simulation or practice mode for focused study.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                        <div className="relative group">
                            <Link href="/game" className="block">
                                <div className="rounded-lg shadow-xl overflow-hidden transform transition duration-200 hover:scale-105 hover:shadow-2xl">
                                    <div className="bg-blue-600 p-8 text-center">
                                        <h2 className="text-3xl font-bold text-white mb-4">Game Mode</h2>
                                        <p className="text-lg text-white">
                                            Experience a complete Jeopardy simulation with authentic categories, varying difficulty levels, and competitive scoring.
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        </div>

                        <div className="relative group">
                            <Link href="/practice" className="block">
                                <div className="rounded-lg shadow-xl overflow-hidden transform transition duration-200 hover:scale-105 hover:shadow-2xl">
                                    <div className="bg-green-600 p-8 text-center">
                                        <h2 className="text-3xl font-bold text-white mb-4">Practice Mode</h2>
                                        <p className="text-lg text-white">
                                            Study at your own pace with our comprehensive flashcard system. Focus on specific categories and track your progress.
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {!loading && !user && (
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-900">Track Your Progress</h2>
                            <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-500">
                                Sign in to track your progress, compete on the leaderboard, and get personalized category recommendations based on your performance.
                            </p>
                        </div>
                    )}
                </div>

                <footer className="text-center text-gray-600 mt-8 text-sm">
                    <p>Trivrdy is a Jeopardy study tool created by <a href="https://tuckercraig.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Tucker Craig</a>. Practice with real questions, compete with others, and improve your trivia knowledge.</p>
                </footer>
            </main>
        </div>
    )
}
