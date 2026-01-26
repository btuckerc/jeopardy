import './globals.css'
import { Inter, Fredoka } from 'next/font/google'
import Link from 'next/link'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'
import { PageTitle } from './components/PageTitle'
import { Navigation } from '@/components/Navigation'
import { ClerkProvider } from '@clerk/nextjs'
import { syncAdminRoles } from '@/lib/sync-admin-roles'
import { getAppUser } from '@/lib/clerk-auth'
import { JsonLd } from '@/components/JsonLd'
import KeyboardShortcutsProvider from './components/KeyboardShortcutsProvider'

const inter = Inter({ subsets: ['latin'] })
const fredoka = Fredoka({ weight: '500', subsets: ['latin'] })

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
}

export const metadata = {
    metadataBase: new URL(
        process.env.NODE_ENV === 'production'
            ? 'https://www.trivrdy.com'
            : 'http://localhost:3000'
    ),
    title: 'trivrdy - Free Jeopardy Practice & Study Tool | 12,000+ Questions',
    description: 'Practice Jeopardy with 12,000+ authentic questions. Free study tool with flashcards, game mode, leaderboards, and progress tracking. Master trivia and compete globally.',
    keywords: 'jeopardy, trivia game, study jeopardy, practice trivia, trivrdy, jeopardy simulator, jeopardy practice, trivia practice, quiz game, knowledge quiz, online trivia, jeopardy questions, trivia study, tucker craig, game show practice',
    authors: [{ name: 'Tucker Craig', url: 'https://tuckercraig.com' }],
    creator: 'Tucker Craig',
    publisher: 'Tucker Craig',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://trivrdy.com',
        siteName: 'trivrdy',
        title: 'trivrdy - Free Jeopardy Practice & Study Tool | 12,000+ Questions',
        description: 'Practice Jeopardy with 12,000+ authentic questions. Free study tool with flashcards, game mode, leaderboards, and progress tracking. Master trivia and compete globally.',
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
        title: 'trivrdy - Free Jeopardy Practice & Study Tool',
        description: 'Practice Jeopardy with 12,000+ authentic questions. Free study tool with flashcards, game mode, and leaderboards.',
        images: ['/og-image.png'],
        creator: '@btuckerc',
        site: '@btuckerc',
    },
    alternates: {
        canonical: 'https://trivrdy.com',
        types: {
            'application/atom+xml': 'https://bsky.app/profile/btuckerc.com',
        },
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
    other: {
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-title': 'trivrdy',
        'mobile-web-app-capable': 'yes',
        'apple-touch-fullscreen': 'yes',
        'msapplication-TileColor': '#1E40AF',
        'msapplication-tap-highlight': 'no',
        'theme-color': '#1E40AF'
    }
}

export default async function RootLayout({
    children,
}: {
        children: React.ReactNode
    }) {
    // Sync admin roles on app startup based on ADMIN_EMAILS env var
    await syncAdminRoles()
    
    // Get the app user (synced from Clerk to Prisma)
    // This replaces the old NextAuth session fetch
    const appUser = await getAppUser()
    
    const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://www.trivrdy.com'
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
            url: 'https://tuckercraig.com',
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
            url: 'https://tuckercraig.com',
        },
    }

    return (
        <ClerkProvider>
            <html lang="en" suppressHydrationWarning>
                <head>
                    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
                    <link rel="canonical" href="https://trivrdy.com" />
                    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
                    <JsonLd data={websiteSchema} />
                    <JsonLd data={softwareApplicationSchema} />
                </head>
                <body className={inter.className}>
                    <Providers>
                        <KeyboardShortcutsProvider>
                            <PageTitle />
                            <div className="min-h-screen bg-gray-100 flex flex-col">
                                <Navigation fredokaClassName={fredoka.className} appUser={appUser} />
                                <main className="flex-1 max-w-7xl mx-auto pt-6 pb-0 sm:px-6 lg:px-8">
                                    {children}
                                </main>

                            {/* Global footer */}
                            <footer className="border-t border-gray-200 bg-gray-50">
                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                                    <div className="text-center space-y-2">
                                        <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 mb-2">
                                            <Link
                                                href="/help"
                                                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                            >
                                                Help & Feedback
                                            </Link>
                                            <span className="text-gray-400">•</span>
                                            <Link
                                                href="/help#report"
                                                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                            >
                                                Report an Issue
                                            </Link>
                                        </div>
                                        <p className="text-gray-600 text-sm">
                                            Made by{' '}
                                            <a
                                                href="https://tuckercraig.com"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                            >
                                                Tucker Craig
                                            </a>
                                        </p>
                                        <p className="text-gray-500 text-xs">
                                            Real Jeopardy questions, real practice, real improvement.
                                        </p>
                                    </div>
                                </div>
                            </footer>
                        </div>
                        <Toaster position="bottom-right" />
                        </KeyboardShortcutsProvider>
                    </Providers>
                </body>
            </html>
        </ClerkProvider>
    )
}
