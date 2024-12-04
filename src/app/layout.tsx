import './globals.css'
import { Inter, Fredoka } from 'next/font/google'
import { Providers } from './providers'
import { AuthButton } from './components/AuthButton'
import { Toaster } from 'react-hot-toast'
import Link from 'next/link'
import { PageTitle } from './components/PageTitle'

const inter = Inter({ subsets: ['latin'] })
const fredoka = Fredoka({ weight: '300', subsets: ['latin'] })

export const metadata = {
  title: 'trivrdy - study jeopardy questions online',
  description: 'Practice your trivia skills with a Jeopardy-style learning app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>
        <Providers>
          <PageTitle />
          <div className="min-h-screen bg-gray-100">
            <nav className="bg-blue-800 text-white shadow-lg">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                  <div className="flex items-center">
                    <Link href="/" className="flex-shrink-0">
                      <span className={`${fredoka.className} text-2xl`}>trivrdy</span>
                    </Link>
                    <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                      <Link href="/game" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        Play Game
                      </Link>
                      <Link href="/practice" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        Free Play
                      </Link>
                      <Link href="/stats" className="text-white hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        Statistics
                      </Link>
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
