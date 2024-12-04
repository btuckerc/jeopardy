import './globals.css'
import { Inter, Fredoka } from 'next/font/google'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'
import { PageTitle } from './components/PageTitle'
import { Navigation } from '@/components/Navigation'

const inter = Inter({ subsets: ['latin'] })
const fredoka = Fredoka({ weight: '300', subsets: ['latin'] })

export const metadata = {
  title: 'trivrdy - Study Jeopardy Online | Practice Trivia Game',
  description: 'Practice Jeopardy-style trivia with trivrdy. Features game mode, practice mode, and leaderboards. Created by Tucker Craig.',
  keywords: 'jeopardy, trivia game, study jeopardy, practice trivia, trivrdy, jeopardy simulator, tucker craig',
  authors: [{ name: 'Tucker Craig', url: 'https://tuckercraig.com' }],
  creator: 'Tucker Craig',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://trivrdy.com',
    siteName: 'trivrdy',
    title: 'trivrdy - Study Jeopardy Online | Practice Trivia Game',
    description: 'Practice Jeopardy-style trivia with trivrdy. Features game mode, practice mode, and leaderboards. Created by Tucker Craig.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'trivrdy - Jeopardy Study Game',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'trivrdy - Study Jeopardy Online',
    description: 'Practice Jeopardy-style trivia with trivrdy. Features game mode, practice mode, and leaderboards.',
    images: ['/og-image.png'],
    creator: '@btuckerc',
    site: '@btuckerc',
  },
  alternates: {
    types: {
      'application/atom+xml': 'https://bsky.app/profile/btuckerc.com',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-site-verification-code-here',
  },
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
        <link rel="canonical" href="https://trivrdy.com" />
      </head>
      <body className={inter.className}>
        <Providers>
          <PageTitle />
          <div className="min-h-screen bg-gray-100">
            <Navigation fredokaClassName={fredoka.className} />
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
