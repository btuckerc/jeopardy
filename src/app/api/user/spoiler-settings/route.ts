import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

type SpoilerSettings = {
    spoilerBlockDate: Date | null;
    spoilerBlockEnabled: boolean;
    lastSpoilerPrompt: Date | null;
}

export async function GET(request: Request) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // First check if user exists
        const userExists = await prisma.user.count({
            where: { id: session.user.id }
        });

        if (!userExists) {
            // Create user if doesn't exist
            await prisma.user.create({
                data: {
                    id: session.user.id,
                    email: session.user.email!,
                    spoilerBlockEnabled: true
                }
            });
        }

        // Then get settings
        const settings = await prisma.$queryRaw<SpoilerSettings[]>`
            SELECT "spoilerBlockDate", "spoilerBlockEnabled", "lastSpoilerPrompt"
            FROM "User"
            WHERE id = ${session.user.id}
            LIMIT 1
        `;

        return NextResponse.json(settings[0] || {
            spoilerBlockEnabled: true,
            spoilerBlockDate: null,
            lastSpoilerPrompt: null
        });
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

        // First check if user exists
        const userExists = await prisma.user.count({
            where: { id: session.user.id }
        });

        if (!userExists) {
            // Create user if doesn't exist
            await prisma.user.create({
                data: {
                    id: session.user.id,
                    email: session.user.email!,
                    spoilerBlockEnabled: spoilerBlockEnabled ?? true,
                    spoilerBlockDate: spoilerBlockDate ? new Date(spoilerBlockDate) : null,
                    lastSpoilerPrompt: lastSpoilerPrompt ? new Date(lastSpoilerPrompt) : null
                }
            });
        } else {
            // Update existing user
            await prisma.user.update({
                where: { id: session.user.id },
                data: {
                    spoilerBlockEnabled: spoilerBlockEnabled ?? undefined,
                    spoilerBlockDate: spoilerBlockDate ? new Date(spoilerBlockDate) : null,
                    lastSpoilerPrompt: lastSpoilerPrompt ? new Date(lastSpoilerPrompt) : null
                }
            });
        }

        // Get updated settings
        const settings = await prisma.$queryRaw<SpoilerSettings[]>`
            SELECT "spoilerBlockDate", "spoilerBlockEnabled", "lastSpoilerPrompt"
            FROM "User"
            WHERE id = ${session.user.id}
            LIMIT 1
        `;

        return NextResponse.json(settings[0]);
    } catch (error) {
        console.error('Error updating spoiler settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 