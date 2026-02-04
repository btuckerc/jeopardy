import { getAppUser } from '@/lib/clerk-auth'
import HelpClient from './HelpClient'
import { Metadata } from 'next'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
    title: 'Help Center | trivrdy Support & FAQ',
    description: 'Get help with trivrdy, find answers to frequently asked questions, report bugs, and request features. Support for Jeopardy practice and trivia study.',
    keywords: 'trivrdy help, jeopardy study help, trivia app support, trivrdy FAQ, report bug, feature request, trivrdy support, trivia game help',
    openGraph: {
        title: 'Help Center | trivrdy Support & FAQ',
        description: 'Get help with trivrdy, find answers to frequently asked questions, report bugs, and request features.',
        url: 'https://trivrdy.com/help',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Help Center | trivrdy Support & FAQ',
        description: 'Get help with trivrdy, find answers to frequently asked questions, report bugs, and request features.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/help',
    },
}

const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'Who made trivrdy?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: "My name is Tucker. I'm a senior software engineer. This is a personal project. I really like Jeopardy, wanted a place to study, thought I might make something out of it. I made this mostly for myself but can see the utility in sharing this with other people. If you want to reach out, hit the Email Support button - the email goes directly to me.",
            },
        },
        {
            '@type': 'Question',
            name: 'What is trivrdy?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'trivrdy is a free Jeopardy study tool that helps you study with authentic Jeopardy questions. With over 12,000 questions from real Jeopardy episodes, you can improve your trivia knowledge, track your progress, and compete on leaderboards.',
            },
        },
        {
            '@type': 'Question',
            name: 'What is study mode?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Study mode is a focused way to practice specific topics. You can study by category, round, or challenge yourself with triple stumpers. Study mode games still count toward your stats and streaks, so you can track your progress while focusing on areas you want to improve.',
            },
        },
        {
            '@type': 'Question',
            name: 'Is trivrdy affiliated with Jeopardy?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'No, trivrdy is not affiliated with, endorsed by, or connected to Jeopardy Productions or Sony Pictures Entertainment. This is an independent fan project created for educational purposes.',
            },
        },
        {
            '@type': 'Question',
            name: 'Do I need an account to use trivrdy?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'You can use trivrdy as a guest to study questions and play games, but signing in unlocks additional features including progress tracking, leaderboards, daily challenge history, achievements, and personalized stats. Creating an account is free and only takes a moment.',
            },
        },
        {
            '@type': 'Question',
            name: 'How accurate are the answers?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Questions and answers are sourced from J! Archive, which contains data from historical Jeopardy episodes. While we strive for accuracy, edge cases or alternative acceptable answers may exist. If you believe an answer was incorrectly marked, you can dispute it using the dispute feature, or report it as a content issue.',
            },
        },
        {
            '@type': 'Question',
            name: 'How do I report a bad ruling or wrong question?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'If you believe an answer was incorrectly marked during gameplay or study mode, you can dispute it directly from the question result screen. For general content issues or questions about answer accuracy, you can use the Report an Issue form and select Content Issue as the category.',
            },
        },
        {
            '@type': 'Question',
            name: 'What data does trivrdy store?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'We store your account information (email, display name), gameplay statistics, daily challenge results, and progress tracking data. This information is used to provide personalized features like leaderboards, achievements, and progress tracking. We do not share your data with third parties.',
            },
        },
    ],
}

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://trivrdy.com',
        },
        {
            '@type': 'ListItem',
            position: 2,
            name: 'Help Center',
            item: 'https://trivrdy.com/help',
        },
    ],
}

export const dynamic = 'force-dynamic'

export default async function HelpPage() {
    const user = await getAppUser()
    
    const supportEmail = process.env.SMTP_USER || null

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    <h1 className="text-4xl sm:text-5xl font-bold mb-4">Help & Feedback</h1>
                    <p className="text-xl text-blue-100 max-w-2xl">
                        Have a question, found a bug, or want to suggest a feature? I&apos;m here to help.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <HelpClient user={user} supportEmail={supportEmail} />
            </div>
            <JsonLd data={faqSchema} />
            <JsonLd data={breadcrumbSchema} />
        </div>
    )
}

