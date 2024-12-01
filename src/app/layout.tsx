import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { AuthButton } from './components/AuthButton'
import { Toaster } from 'react-hot-toast'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Jeopardy Practice',
  description: 'Practice your trivia skills with a Jeopardy-style learning app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-100">
            <nav className="bg-blue-800 text-white shadow-lg">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-xl font-bold">Jeopardy Practice</span>
                    </div>
                    <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                      <a href="/" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        Home
                      </a>
                      <a href="/game" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        Play Game
                      </a>
                      <a href="/practice" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        Practice Mode
                      </a>
                      <a href="/stats" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        Statistics
                      </a>
                      <a href="/settings" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        Settings
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <AuthButton />
                  </div>
                </div>
              </div>
            </nav>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  )
}
