import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAppUser } from '@/lib/clerk-auth'

export async function getAuthUser() {
    const appUser = await getAppUser()

    if (!appUser) {
        const headersList = await headers()
        const pathname = headersList.get('x-pathname') || headersList.get('referer') || '/'
        const currentPath = pathname.startsWith('http') ? new URL(pathname).pathname : pathname
        redirect(`/sign-in?redirect_url=${encodeURIComponent(currentPath)}`)
    }

    return appUser
}
