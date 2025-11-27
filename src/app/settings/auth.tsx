import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/clerk-auth'

export async function getAuthUser() {
    const appUser = await getAppUser()

    if (!appUser) {
        redirect('/sign-in')
    }

    return appUser
}
