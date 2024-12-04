'use client'

import Link from 'next/link'
import { useAuth } from './lib/auth'
import { useEffect } from 'react'

export default function Home() {
  const { user, loading } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            Study Jeopardy Online with trivrdy
          </h1>
          <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
            Practice your trivia skills with our Jeopardy-style learning app. Choose between game mode for a full game simulation or practice mode for focused study.
          </p>
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div className="relative group">
              <Link href="/game" className="block">
                <div className="rounded-lg shadow-xl overflow-hidden transform transition duration-200 hover:scale-105 hover:shadow-2xl">
                  <div className="bg-blue-600 p-12 text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">Game Mode</h2>
                    <p className="mt-4 text-lg text-white">
                      Experience a complete Jeopardy simulation with authentic categories, varying difficulty levels, and competitive scoring.
                    </p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="relative group">
              <Link href="/practice" className="block">
                <div className="rounded-lg shadow-xl overflow-hidden transform transition duration-200 hover:scale-105 hover:shadow-2xl">
                  <div className="bg-green-600 p-12 text-center">
                    <h2 className="text-3xl font-bold text-white mb-6">Practice Mode</h2>
                    <p className="mt-4 text-lg text-white">
                      Study at your own pace with our comprehensive flashcard system. Focus on specific categories and track your progress.
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {!loading && !user && (
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Track Your Progress</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-500">
              Sign in to track your progress, compete on the leaderboard, and get personalized category recommendations based on your performance.
            </p>
          </div>
        )}
      </div>
      <div className="container mx-auto px-4 py-8 text-center text-gray-600">
        <p>Trivrdy is a Jeopardy study tool created by Tucker Craig. Practice with real questions, compete with others, and improve your trivia knowledge.</p>
      </div>
    </div>
  )
}
