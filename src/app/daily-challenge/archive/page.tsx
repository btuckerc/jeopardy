import { Metadata } from 'next'
import { getAppUser } from '@/lib/clerk-auth'
import ArchiveClient from '@/app/daily-challenge/archive/ArchiveClient'

export const metadata: Metadata = {
    title: 'Daily Challenge Archive | trivrdy',
    description: 'View and complete past daily challenges from the last 7 days. Catch up on missed days and maintain your streak.',
}

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
    const user = await getAppUser()
    
    return (
        <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen -mt-6 min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
            {/* Shadow under navbar */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
            
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                        Daily Challenge Archive
                    </h1>
                    <p className="text-blue-200 text-lg max-w-2xl mx-auto">
                        Catch up on challenges from the last 7 days. Complete missed days to restore your streak!
                    </p>
                </div>
                
                {/* Client Component */}
                <ArchiveClient />
            </div>
        </div>
    )
}
