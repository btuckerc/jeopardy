import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function GET(request: Request) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Use service role client for database operations
        const { data: userData, error: userError } = await supabaseAdmin
            .from('User')
            .upsert({
                id: session.user.id,
                email: session.user.email!,
                spoilerBlockEnabled: true
            }, {
                onConflict: 'id'
            })
            .select('spoilerBlockDate, spoilerBlockEnabled, lastSpoilerPrompt')
            .single();

        if (userError) throw userError;

        return NextResponse.json(userData);
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

        // Use service role client for database operations
        const { data: userData, error: userError } = await supabaseAdmin
            .from('User')
            .upsert({
                id: session.user.id,
                email: session.user.email!,
                spoilerBlockEnabled: spoilerBlockEnabled ?? true,
                spoilerBlockDate: spoilerBlockDate,
                lastSpoilerPrompt: lastSpoilerPrompt
            }, {
                onConflict: 'id'
            })
            .select('spoilerBlockDate, spoilerBlockEnabled, lastSpoilerPrompt')
            .single();

        if (userError) throw userError;

        return NextResponse.json(userData);
    } catch (error) {
        console.error('Error updating spoiler settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 