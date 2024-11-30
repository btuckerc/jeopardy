import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

        if (user) {
            // Create or update user in our database
            await prisma.user.upsert({
                where: { id: user.id },
                update: { email: user.email },
                create: {
                    id: user.id,
                    email: user.email!,
                }
            })
        }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(requestUrl.origin)
} 