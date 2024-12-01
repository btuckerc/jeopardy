import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { startOfDay } from 'date-fns';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const session = await getServerSession();

    try {
        // Get user's spoiler settings if logged in
        let spoilerBlockDate: Date | null = null;
        let spoilerBlockEnabled = false;

        if (session?.user?.id) {
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: {
                    spoilerBlockDate: true,
                    spoilerBlockEnabled: true
                }
            });

            if (user) {
                spoilerBlockDate = user.spoilerBlockDate;
                spoilerBlockEnabled = user.spoilerBlockEnabled;
            }
        }

        // Build where clause based on spoiler settings
        const where: any = {};

        if (spoilerBlockDate) {
            where.airDate = {
                lte: spoilerBlockDate
            };
        }

        if (spoilerBlockEnabled) {
            where.airDate = {
                ...where.airDate,
                lt: startOfDay(new Date())
            };
        }

        // Add any other filters from searchParams
        if (searchParams.has('category')) {
            where.category = { name: searchParams.get('category') };
        }

        if (searchParams.has('difficulty')) {
            where.difficulty = searchParams.get('difficulty');
        }

        const questions = await prisma.question.findMany({
            where,
            include: {
                category: true
            },
            take: 50,
            orderBy: {
                airDate: 'desc'
            }
        });

        return NextResponse.json(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 