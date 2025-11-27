import './globals.css'
import { Inter, Fredoka } from 'next/font/google'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'
import { PageTitle } from './components/PageTitle'
import { Navigation } from '@/components/Navigation'
import { auth } from '@/lib/auth'
import { syncAdminRoles } from '@/lib/sync-admin-roles'

const inter = Inter({ subsets: ['latin'] })
const fredoka = Fredoka({ weight: '300', subsets: ['latin'] })

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

export const metadata = {
    metadataBase: new URL(
        process.env.NODE_ENV === 'production'
            ? 'https://www.trivrdy.com'
            : 'http://localhost:3000'
    ),
    title: 'trivrdy - Study Jeopardy Online | Practice Trivia Game',
    description: 'Master trivia with trivrdy\'s Jeopardy study platform. Play authentic questions, track progress, and compete on leaderboards. Features practice mode and full game simulations. Created by Tucker Craig.',
    keywords: 'jeopardy, trivia game, study jeopardy, practice trivia, trivrdy, jeopardy simulator, jeopardy practice, trivia practice, quiz game, knowledge quiz, online trivia, jeopardy questions, trivia study, tucker craig, game show practice',
    authors: [{ name: 'Tucker Craig', url: 'https://tuckercraig.com' }],
    creator: 'Tucker Craig',
    publisher: 'Tucker Craig',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://trivrdy.com',
        siteName: 'trivrdy',
        title: 'trivrdy - Study Jeopardy Online | Practice Trivia Game',
        description: 'Master trivia with trivrdy\'s Jeopardy study platform. Play authentic questions, track progress, and compete on leaderboards. Features practice mode and full game simulations.',
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
        description: 'Master trivia with trivrdy. Practice authentic Jeopardy questions, track progress, and compete globally.',
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
    
    // Fetch session on the server - this is the key to avoiding flash
    const session = await auth()
    
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="icon" href="/icon.svg" type="image/svg+xml" />
                <link rel="canonical" href="https://trivrdy.com" />
                <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
            </head>
            <body className={inter.className}>
                <Providers session={session}>
                    <PageTitle />
                    <div className="min-h-screen bg-gray-100">
                        <Navigation fredokaClassName={fredoka.className} session={session} />
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
