'use client'

import Link from 'next/link'
import { useAuth } from './lib/auth'

export default function Home() {
  const { user, loading } = useAuth()

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            Practice Jeopardy
          </h1>
          <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
            Improve your trivia skills with our Jeopardy practice app. Choose your mode and start learning!
          </p>
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div className="relative group">
              <Link href="/game" className="block">
                <div className="rounded-lg shadow-lg overflow-hidden transform transition duration-200 hover:scale-105">
                  <div className="bg-blue-600 p-8">
                    <h3 className="text-2xl font-bold text-white">Game Mode</h3>
                    <p className="mt-2 text-white">
                      Play a simulated Jeopardy game with categories and varying difficulty levels.
                    </p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="relative group">
              <Link href="/practice" className="block">
                <div className="rounded-lg shadow-lg overflow-hidden transform transition duration-200 hover:scale-105">
                  <div className="bg-green-600 p-8">
                    <h3 className="text-2xl font-bold text-white">Free Play Mode</h3>
                    <p className="mt-2 text-white">
                      Study with flashcards and explore specific categories at your own pace.
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Only render this section after loading is complete and user is not logged in */}
        {!loading && !user && (
          <div className="mt-16 text-center opacity-0 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900">Track Your Progress</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-500">
              Sign in to track your progress, see statistics, and get personalized category recommendations based on your performance.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
