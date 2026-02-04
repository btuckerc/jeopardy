import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { getAppUser } from '@/lib/clerk-auth'
import AdminClient from './AdminClient'

export const metadata: Metadata = {
    title: 'Admin | trivrdy',
    description: 'Administrative dashboard for trivrdy.',
    robots: {
        index: false,
        follow: false,
    },
}

export default async function AdminPage() {
    const user = await getAppUser()
    
    if (!user) {
        redirect('/sign-in?redirect_url=/admin')
    }
    
    if (user.role !== 'ADMIN') {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold text-black mb-4">Access Denied</h1>
                    <p className="text-gray-600">
                        Admin privileges required to access this page.
                    </p>
                </div>
            </div>
        )
    }
    
    return <AdminClient user={user} initialGames={[]} />
}
