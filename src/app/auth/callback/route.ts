import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

function generateRandomUsername() {
    const adjectives = ['Happy', 'Lucky', 'Clever', 'Bright', 'Swift', 'Quick', 'Smart', 'Cool', 'Wise', 'Brave']
    const nouns = ['Player', 'Gamer', 'Champion', 'Master', 'Expert', 'Genius', 'Scholar', 'Ace', 'Star', 'Hero']
    const randomNum = Math.floor(Math.random() * 1000)
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    return `${adj}${noun}${randomNum}`
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const cookieStore = cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

        try {
            const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

            if (error) {
                console.error('Error exchanging code for session:', error)
                return NextResponse.redirect(`${requestUrl.origin}?error=auth`)
            }

            if (session?.user) {
                // Create or update user in our database
                await prisma.user.upsert({
                    where: { id: session.user.id },
                    update: {
                        email: session.user.email
                    },
                    create: {
                        id: session.user.id,
                        email: session.user.email!,
                        displayName: generateRandomUsername()
                    }
                })

                // Update user metadata in Supabase
                await supabase.auth.updateUser({
                    data: {
                        displayName: generateRandomUsername()
                    }
                })

                // Redirect to home page with auth state
                const response = NextResponse.redirect(requestUrl.origin)

                // Set auth cookie with proper options
                response.cookies.set('sb-access-token', session.access_token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                    domain: process.env.NODE_ENV === 'production' ? '.trivrdy.com' : undefined
                })

                response.cookies.set('sb-refresh-token', session.refresh_token!, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                    domain: process.env.NODE_ENV === 'production' ? '.trivrdy.com' : undefined
                })

                return response
            }
        } catch (error) {
            console.error('Error in auth callback:', error)
            return NextResponse.redirect(`${requestUrl.origin}?error=auth`)
        }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(requestUrl.origin)
} 