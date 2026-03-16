import { Metadata } from 'next'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
    title: 'Privacy Policy | trivrdy',
    description: 'Privacy policy for trivrdy - Learn how we collect, use, and protect your personal information when you use our Jeopardy study platform.',
    keywords: 'trivrdy privacy policy, trivia app privacy, jeopardy study privacy, user data policy',
    openGraph: {
        title: 'Privacy Policy | trivrdy',
        description: 'Privacy policy for trivrdy - Learn how we collect, use, and protect your personal information.',
        url: 'https://trivrdy.com/privacy',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'Privacy Policy | trivrdy',
        description: 'Privacy policy for trivrdy - Learn how we collect, use, and protect your personal information.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/privacy',
    },
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
            name: 'Privacy Policy',
            item: 'https://trivrdy.com/privacy',
        },
    ],
}

export default function PrivacyPage() {
    return (
        <>
            <JsonLd data={breadcrumbSchema} />
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

                <div className="prose prose-blue max-w-none">
                    <p className="text-gray-600 mb-6">
                        <strong>Last updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Introduction</h2>
                        <p className="text-gray-600 mb-4">
                            trivrdy (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates trivrdy.com. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Jeopardy study platform.
                        </p>
                        <p className="text-gray-600">
                            Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Information We Collect</h2>

                        <h3 className="text-lg font-medium text-gray-900 mb-2">Personal Data</h3>
                        <p className="text-gray-600 mb-4">
                            We collect personal information that you voluntarily provide to us when you register on the Website, express an interest in obtaining information about us or our products and services, when you participate in activities on the Website, or otherwise when you contact us. This includes:
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                            <li>Email address (for account creation via Clerk authentication)</li>
                            <li>Display name and profile information</li>
                            <li>Game statistics and progress data</li>
                            <li>Answers to trivia questions and performance metrics</li>
                        </ul>

                        <h3 className="text-lg font-medium text-gray-900 mb-2">Automatically Collected Data</h3>
                        <p className="text-gray-600">
                            When you access the Website, we may automatically collect certain information including your IP address, browser type, operating system, access times, and pages viewed.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
                        <p className="text-gray-600 mb-4">
                            We use personal information collected via our Website for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                            <li>To facilitate account creation and logon functionality</li>
                            <li>To provide and maintain our services</li>
                            <li>To track your progress and performance in Jeopardy games</li>
                            <li>To compile anonymous, aggregated statistics about user behavior</li>
                            <li>To communicate with you about updates, new features, or support</li>
                            <li>To protect against fraud and ensure security</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sharing Your Information</h2>
                        <p className="text-gray-600 mb-4">
                            We only share information with the following third parties:
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                            <li><strong>Clerk</strong> - Authentication services</li>
                            <li><strong>Vercel</strong> - Hosting and deployment</li>
                            <li><strong>PostgreSQL</strong> - Database hosting</li>
                        </ul>
                        <p className="text-gray-600">
                            We do not sell your personal information to third parties.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Security</h2>
                        <p className="text-gray-600 mb-4">
                            We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Rights</h2>
                        <p className="text-gray-600 mb-4">
                            Depending on your location, you may have rights regarding your personal information, including:
                        </p>
                        <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                            <li>The right to access personal information we hold about you</li>
                            <li>The right to request correction of your personal information</li>
                            <li>The right to request deletion of your personal information</li>
                            <li>The right to opt out of marketing communications</li>
                        </ul>
                        <p className="text-gray-600">
                            To exercise these rights, please contact us through the Help page.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Children&apos;s Privacy</h2>
                        <p className="text-gray-600">
                            Our Website is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us so we can delete such information.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
                        <p className="text-gray-600">
                            We may update this privacy policy from time to time. The updated version will be indicated by an updated &quot;Last updated&quot; date at the top of this policy. We encourage you to review this privacy policy frequently to stay informed about how we are protecting your information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
                        <p className="text-gray-600">
                            If you have questions or comments about this policy, you may contact us through the <a href="/help" className="text-blue-600 hover:text-blue-800">Help & Feedback</a> page on our Website.
                        </p>
                    </section>
                </div>
            </div>
        </>
    )
}
