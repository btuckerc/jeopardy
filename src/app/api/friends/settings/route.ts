import { z } from 'zod'
import { FriendVisibility } from '@prisma/client'
import { NextRequest } from 'next/server'
import { badRequestResponse, jsonResponse, parseBody, requireAuth, serverErrorResponse } from '@/lib/api-utils'
import { getFriendSettings, setFriendSettings } from '@/lib/friends'
import { withInstrumentation } from '@/lib/api-instrumentation'

const friendSettingsSchema = z.object({
    friendVisibility: z.nativeEnum(FriendVisibility).optional(),
    allowFriendRequests: z.coerce.boolean().optional(),
})

export const GET = withInstrumentation(async (_request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    try {
        const settings = await getFriendSettings(user.id)
        return jsonResponse({ settings })
    } catch (error) {
        return serverErrorResponse('Error loading friend settings', error)
    }
})

export const PATCH = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const parsed = await parseBody(request, friendSettingsSchema)
    if (parsed.error) return parsed.error
    if (!parsed.data.friendVisibility && typeof parsed.data.allowFriendRequests !== 'boolean') {
        return badRequestResponse('No settings provided')
    }

    try {
        const settings = await setFriendSettings(user.id, {
            friendVisibility: parsed.data.friendVisibility,
            allowFriendRequests: parsed.data.allowFriendRequests,
        })

        return jsonResponse({
            settings,
        })
    } catch (error) {
        return serverErrorResponse('Error updating friend settings', error)
    }
})

export const dynamic = 'force-dynamic'
