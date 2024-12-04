import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true,
                lastSpoilerPrompt: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error('Error fetching spoiler settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { spoilerBlockDate, spoilerBlockEnabled, lastSpoilerPrompt } = body;

        const user = await prisma.user.upsert({
            where: { id: session.user.id },
            update: {
                spoilerBlockDate: spoilerBlockDate ? new Date(spoilerBlockDate) : null,
                spoilerBlockEnabled: spoilerBlockEnabled !== undefined ? spoilerBlockEnabled : undefined,
                lastSpoilerPrompt: lastSpoilerPrompt ? new Date(lastSpoilerPrompt) : undefined
            },
            create: {
                id: session.user.id,
                email: session.user.email!,
                spoilerBlockDate: spoilerBlockDate ? new Date(spoilerBlockDate) : null,
                spoilerBlockEnabled: spoilerBlockEnabled !== undefined ? spoilerBlockEnabled : false,
                lastSpoilerPrompt: lastSpoilerPrompt ? new Date(lastSpoilerPrompt) : null
            },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true,
                lastSpoilerPrompt: true
            }
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error('Error updating spoiler settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 