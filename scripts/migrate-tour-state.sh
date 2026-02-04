#!/bin/bash
# Migration script for tour state fields

echo "=== Tour State Migration Helper ==="
echo ""
echo "This script will add tour state fields to the User table."
echo ""
echo "Step 1: Running Prisma migration..."
docker compose exec web npx prisma migrate dev --name add_tour_state_fields

echo ""
echo "Step 2: Verifying migration..."
docker compose exec web npx prisma generate

echo ""
echo "Step 3: Checking if API route exists..."
if [ ! -f "src/app/api/user/tour-state/route.ts" ]; then
	echo "API route not found. Creating from template..."

	mkdir -p src/app/api/user/tour-state

	cat >src/app/api/user/tour-state/route.ts <<'EOF'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

/**
 * GET /api/user/tour-state
 * Get user's onboarding tour state
 */
export async function GET() {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        return jsonResponse({
            hasSeenTour: user.hasSeenTour,
            tourCompleted: user.tourCompleted,
            tourDismissed: user.tourDismissed,
            tourDismissedAt: user.tourDismissedAt?.toISOString() || null
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch tour state', error)
    }
}

/**
 * POST /api/user/tour-state
 * Update user's onboarding tour state
 */
export async function POST(request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        const body = await request.json()
        const { action } = body

        if (!action || !['complete', 'dismiss', 'start'].includes(action)) {
            return jsonResponse({ error: 'Invalid action. Use: complete, dismiss, or start' }, 400)
        }

        let updateData: any = {}

        switch (action) {
            case 'complete':
                updateData = {
                    hasSeenTour: true,
                    tourCompleted: true,
                    tourDismissed: false
                }
                break
            case 'dismiss':
                updateData = {
                    hasSeenTour: true,
                    tourDismissed: true,
                    tourDismissedAt: new Date()
                }
                break
            case 'start':
                updateData = {
                    hasSeenTour: true
                }
                break
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
            select: {
                hasSeenTour: true,
                tourCompleted: true,
                tourDismissed: true,
                tourDismissedAt: true
            }
        })

        return jsonResponse({
            success: true,
            hasSeenTour: updatedUser.hasSeenTour,
            tourCompleted: updatedUser.tourCompleted,
            tourDismissed: updatedUser.tourDismissed,
            tourDismissedAt: updatedUser.tourDismissedAt?.toISOString() || null
        })
    } catch (error) {
        return serverErrorResponse('Failed to update tour state', error)
    }
}
EOF
	echo "API route created!"
else
	echo "API route already exists."
fi

echo ""
echo "=== Migration complete! ==="
echo ""
echo "Next steps:"
echo "1. Rebuild the application: docker compose up -d --build web"
echo "2. Update useOnboarding hook to use server state instead of localStorage"
echo ""
