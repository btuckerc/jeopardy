import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function getAuthUser() {
    const session = await auth()

    if (!session?.user) {
        redirect('/auth/signin')
    }

    return session.user
}
