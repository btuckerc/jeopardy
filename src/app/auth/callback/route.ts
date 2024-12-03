import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = createRouteHandlerClient({ cookies })
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
                    update: { email: session.user.email },
                    create: {
                        id: session.user.id,
                        email: session.user.email!,
                    }
                })

                // Set the auth cookie
                const response = NextResponse.redirect(requestUrl.origin)
                response.cookies.set('supabase-auth-token', session.access_token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/'
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