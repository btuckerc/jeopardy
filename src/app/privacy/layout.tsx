import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Privacy Policy | trivrdy',
    description: 'Read the trivrdy privacy policy to understand what account, gameplay, and analytics data is stored and how it is used.',
    alternates: {
        canonical: 'https://trivrdy.com/privacy',
    },
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: 'Privacy Policy | trivrdy',
        description: 'Read how trivrdy handles account, gameplay, and analytics data.',
        url: 'https://trivrdy.com/privacy',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'Privacy Policy | trivrdy',
        description: 'Read how trivrdy handles account, gameplay, and analytics data.',
    },
}

export default function PrivacyLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
