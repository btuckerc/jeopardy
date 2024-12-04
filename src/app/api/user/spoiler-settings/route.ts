import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get or create user settings using Prisma
        const settings = await prisma.user.upsert({
            where: { id: session.user.id },
            create: {
                id: session.user.id,
                email: session.user.email!,
                spoilerBlockEnabled: true
            },
            update: {},
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true,
                lastSpoilerPrompt: true
            }
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error fetching spoiler settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { spoilerBlockDate, spoilerBlockEnabled, lastSpoilerPrompt } = body;

        // Update user settings using Prisma
        const settings = await prisma.user.upsert({
            where: { id: session.user.id },
            create: {
                id: session.user.id,
                email: session.user.email!,
                spoilerBlockEnabled: spoilerBlockEnabled ?? true,
                spoilerBlockDate: spoilerBlockDate ? new Date(spoilerBlockDate) : null,
                lastSpoilerPrompt: lastSpoilerPrompt ? new Date(lastSpoilerPrompt) : null
            },
            update: {
                spoilerBlockEnabled: spoilerBlockEnabled ?? undefined,
                spoilerBlockDate: spoilerBlockDate ? new Date(spoilerBlockDate) : null,
                lastSpoilerPrompt: lastSpoilerPrompt ? new Date(lastSpoilerPrompt) : null
            },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true,
                lastSpoilerPrompt: true
            }
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error updating spoiler settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 