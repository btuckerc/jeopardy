import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
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
    try {
        const body = await request.json();
        const { userId, spoilerBlockDate, spoilerBlockEnabled, lastSpoilerPrompt } = body;

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const user = await prisma.user.upsert({
            where: { id: userId },
            update: {
                spoilerBlockDate: spoilerBlockDate ? new Date(spoilerBlockDate) : null,
                spoilerBlockEnabled: spoilerBlockEnabled !== undefined ? spoilerBlockEnabled : undefined,
                lastSpoilerPrompt: lastSpoilerPrompt ? new Date(lastSpoilerPrompt) : undefined
            },
            create: {
                id: userId,
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