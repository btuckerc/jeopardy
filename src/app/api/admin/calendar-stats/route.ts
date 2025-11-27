import { jsonResponse, serverErrorResponse, requireAdmin } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    try {
        // Get all distinct air dates
        const dates = await prisma.question.findMany({
            where: {
                airDate: {
                    not: null
                }
            },
            select: {
                airDate: true
            },
            distinct: ['airDate'],
            orderBy: {
                airDate: 'desc'
            }
        })

        const dateSet = new Set(
            dates
                .map(d => d.airDate?.toISOString().split('T')[0])
                .filter(Boolean)
        )

        // Get date range - from earliest question date to today, or last 2 years if no questions
        const today = new Date()
        today.setHours(23, 59, 59, 999) // End of today
        
        let startDate: Date
        if (dates.length > 0 && dates[dates.length - 1].airDate) {
            // Start from earliest question date
            startDate = new Date(dates[dates.length - 1].airDate!)
            startDate.setHours(0, 0, 0, 0)
        } else {
            // Default to 2 years ago if no questions
            startDate = new Date(today)
            startDate.setFullYear(today.getFullYear() - 2)
        }

        const allDates: string[] = []
        const currentDate = new Date(startDate)
        while (currentDate <= today) {
            allDates.push(currentDate.toISOString().split('T')[0])
            currentDate.setDate(currentDate.getDate() + 1)
        }

        const filledDates = allDates.filter(date => dateSet.has(date))
        const missingDates = allDates.filter(date => !dateSet.has(date))

        return jsonResponse({
            filledDates,
            missingDates,
            totalFilled: filledDates.length,
            totalMissing: missingDates.length,
            coverage: filledDates.length / allDates.length
        })
    } catch (error) {
        return serverErrorResponse('Error fetching calendar stats', error)
    }
}

