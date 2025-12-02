import { getAppUser } from '@/lib/clerk-auth'
import HelpClient from './HelpClient'

export const dynamic = 'force-dynamic'

export default async function HelpPage() {
    const user = await getAppUser()
    
    // Get support email from environment variable
    const supportEmail = process.env.SMTP_USER || null

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    <h1 className="text-4xl sm:text-5xl font-bold mb-4">Help & Feedback</h1>
                    <p className="text-xl text-blue-100 max-w-2xl">
                        Have a question, found a bug, or want to suggest a feature? I&apos;m here to help.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <HelpClient user={user} supportEmail={supportEmail} />
            </div>
        </div>
    )
}

