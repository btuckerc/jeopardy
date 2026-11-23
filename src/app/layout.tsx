import './globals.css'
import { Inter, Fredoka } from 'next/font/google'
import Link from 'next/link'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'

import { Navigation } from '@/components/Navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { syncAdminRoles } from '@/lib/sync-admin-roles'
import { getAppUser } from '@/lib/clerk-auth'
import { JsonLd } from '@/components/JsonLd'
import KeyboardShortcutsProvider from './components/KeyboardShortcutsProvider'
import GuestProgressBanner from './components/GuestProgressBanner'
import SiteAnnouncementBanner from './components/SiteAnnouncementBanner'

const inter = Inter({ subsets: ['latin'] })
const fredoka = Fredoka({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-fredoka' })

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    interactiveWidget: 'resizes-content',
}

export const metadata = {
    metadataBase: new URL(
        process.env.NODE_ENV === 'production'
            ? 'https://trivrdy.com'
            : 'http://localhost:3000'
    ),
    title: 'Play Jeopardy Free | Trivia Practice Game - trivrdy',
    description: 'Master Jeopardy with 12,000+ real questions. Free online trivia practice with flashcards, game modes, and leaderboards. Study smart, compete globally, track your progress.',
    keywords: 'jeopardy practice, free jeopardy game, trivia questions, study jeopardy, online trivia game, jeopardy simulator, practice trivia, quiz game, knowledge quiz, trivrdy, jeopardy study tool, trivia flashcards, game show practice, learn trivia',
    authors: [{ name: 'Tucker Craig', url: 'https://btuckerc.dev' }],
    creator: 'Tucker Craig',
    publisher: 'Tucker Craig',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://trivrdy.com',
        siteName: 'trivrdy',
        title: 'Play Jeopardy Free | Trivia Practice Game - trivrdy',
        description: 'Master Jeopardy with 12,000+ real questions. Free online trivia practice with flashcards, game modes, and leaderboards.',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'trivrdy - Free Jeopardy Practice Game with 12,000+ Questions',
            }
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Play Jeopardy Free | Trivia Practice Game - trivrdy',
        description: 'Master Jeopardy with 12,000+ real questions. Free online trivia practice with flashcards, game modes, and leaderboards.',
        images: ['/og-image.png'],
        creator: '@btuckerc',
        site: '@btuckerc',
    },
    robots: {
        index: true,
        follow: true,
        nocache: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': 400,
            noimageindex: false,
        },
    },

    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'trivrdy',
    },
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },

}

export default async function RootLayout({
    children,
}: {
        children: React.ReactNode
    }) {
    const isBuildPhase =
        process.env.npm_lifecycle_event === 'build'
        || process.env.NEXT_PHASE === 'phase-production-build'

    // Avoid build-time DB traffic during `next build`; sync happens at runtime.
    if (!isBuildPhase) {
        await syncAdminRoles()
    }
    
    // Get the app user (synced from Clerk to Prisma)
    // This replaces the old NextAuth session fetch
    const appUser = await getAppUser()
    
    const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://trivrdy.com'
        : 'http://localhost:3000'

    const websiteSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'trivrdy',
        url: baseUrl,
        description: 'Master trivia with trivrdy\'s Jeopardy study platform. Play authentic questions, track progress, and compete on leaderboards.',
        author: {
            '@type': 'Person',
            name: 'Tucker Craig',
            url: 'https://btuckerc.dev',
        },
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${baseUrl}/practice/category?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    }

    const softwareApplicationSchema = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'trivrdy',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web Browser',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            ratingCount: '1',
        },
        description: 'Master trivia with trivrdy\'s Jeopardy study platform. Play authentic questions, track progress, and compete on leaderboards.',
        url: baseUrl,
        author: {
            '@type': 'Person',
            name: 'Tucker Craig',
            url: 'https://btuckerc.dev',
        },
    }

    return (
        <ClerkProvider>
            <html lang="en" suppressHydrationWarning>
                <head>
                    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
                    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
                    <meta name="mobile-web-app-capable" content="yes" />
                    <JsonLd data={websiteSchema} />
                    <JsonLd data={softwareApplicationSchema} />
                </head>
                <body className={`${inter.className} ${fredoka.variable}`}>
                    <Providers initialUser={appUser}>
                        <KeyboardShortcutsProvider>
                            {/* Skip link for accessibility */}
                            <a
                                href="#main-content"
                                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-400 focus:text-blue-950 focus:font-semibold focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                            >
                                Skip to main content
                            </a>
                            <div className="min-h-screen bg-slate-100 flex flex-col">
                                <Navigation fredokaClassName={fredoka.className} appUser={appUser} />
                                <SiteAnnouncementBanner />
                                <main id="main-content" className="flex-1 w-full min-w-0 flex flex-col">
                                    {children}
                                </main>

                            {/* Global footer */}
                            <footer className="border-t border-slate-200 bg-white">
                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                                    <div className="text-center space-y-2">
                                        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-sm text-slate-600 mb-2">
                                            <Link
                                                href="/help"
                                                className="text-blue-700 hover:text-blue-900 font-medium transition-colors"
                                            >
                                                Help & Feedback
                                            </Link>
                                            <span className="text-slate-300" aria-hidden="true">•</span>
                                            <Link
                                                href="/help#report"
                                                className="text-blue-700 hover:text-blue-900 font-medium transition-colors"
                                            >
                                                Report an Issue
                                            </Link>
                                            <span className="text-slate-300" aria-hidden="true">•</span>
                                            <Link
                                                href="/privacy"
                                                className="text-blue-700 hover:text-blue-900 font-medium transition-colors"
                                            >
                                                Privacy Policy
                                            </Link>
                                        </div>
                                        <p className="text-slate-600 text-sm">
                                            Made by{' '}
                                            <a
                                                href="https://btuckerc.dev"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-700 hover:text-blue-900 font-medium transition-colors"
                                            >
                                                Tucker Craig
                                            </a>
                                        </p>
                                        <p className="text-slate-500 text-xs">
                                            Real Jeopardy questions, real practice, real improvement.
                                        </p>
                                    </div>
                                </div>
                            </footer>
                        </div>
                        <Toaster
                            position="bottom-right"
                            containerStyle={{ bottom: 84, right: 16 }}
                        />
                        <GuestProgressBanner />
                        </KeyboardShortcutsProvider>
                    </Providers>
                </body>
            </html>
        </ClerkProvider>
    )
}
