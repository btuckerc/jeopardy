import { FriendRequestStatus } from '@prisma/client'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
    badRequestResponse,
    jsonResponse,
    notFoundResponse,
    parseBody,
    parseSearchParams,
    requireAuth,
    serverErrorResponse,
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { formatFriendCode } from '@/lib/friend-invite'
import {
    ensureFriendInviteIdentity,
    getFriendInviteByCode,
    getFriendInviteByToken,
    getFriendshipBetweenUsers,
    getRequestBetweenUsers,
    hasBlockedRelationship,
    rotateFriendInviteIdentity,
} from '@/lib/friends'

const inviteLookupSchema = z.object({
    token: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
})

const inviteRotateSchema = z.object({
    action: z.literal('rotate'),
})

type InviteState =
    | 'ready'
    | 'self'
    | 'already_friends'
    | 'incoming_pending'
    | 'outgoing_pending'
    | 'blocked'
    | 'requests_disabled'

function shapeInviteState(params: {
    isSelf: boolean
    alreadyFriends: boolean
    hasBlockedRelationship: boolean
    allowFriendRequests: boolean
    existingRequestStatus: FriendRequestStatus | null
    existingRequestFromUserId: string | null
    viewerUserId: string
}): InviteState {
    if (params.isSelf) {
        return 'self'
    }
    if (params.hasBlockedRelationship) {
        return 'blocked'
    }
    if (params.alreadyFriends) {
        return 'already_friends'
    }
    if (!params.allowFriendRequests) {
        return 'requests_disabled'
    }
    if (params.existingRequestStatus === FriendRequestStatus.PENDING) {
        return params.existingRequestFromUserId === params.viewerUserId
            ? 'outgoing_pending'
            : 'incoming_pending'
    }

    return 'ready'
}

export const GET = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const parsed = parseSearchParams(searchParams, inviteLookupSchema)
    if (parsed.error) return parsed.error

    const { token, code } = parsed.data
    if (token && code) {
        return badRequestResponse('Provide either an invite token or a friend code')
    }

    try {
        if (!token && !code) {
            const invite = await ensureFriendInviteIdentity(user.id)
            return jsonResponse({
                invite: {
                    code: invite.friendCode ? formatFriendCode(invite.friendCode) : '',
                    rawCode: invite.friendCode,
                    inviteToken: invite.friendInviteToken,
                    allowFriendRequests: invite.allowFriendRequests,
                },
            })
        }

        const targetUser = token
            ? await getFriendInviteByToken(token)
            : await getFriendInviteByCode(code!)

        if (!targetUser) {
            return notFoundResponse('Invite not found')
        }

        const [friendship, existingRequest, blockedRelationship] = await Promise.all([
            getFriendshipBetweenUsers(user.id, targetUser.id),
            getRequestBetweenUsers(user.id, targetUser.id, {
                status: [FriendRequestStatus.PENDING, FriendRequestStatus.ACCEPTED],
            }),
            hasBlockedRelationship(user.id, targetUser.id),
        ])

        const state = shapeInviteState({
            isSelf: targetUser.id === user.id,
            alreadyFriends: !!friendship || existingRequest?.status === FriendRequestStatus.ACCEPTED,
            hasBlockedRelationship: blockedRelationship,
            allowFriendRequests: targetUser.allowFriendRequests,
            existingRequestStatus: existingRequest?.status ?? null,
            existingRequestFromUserId: existingRequest?.fromUserId ?? null,
            viewerUserId: user.id,
        })

        return jsonResponse({
            invite: {
                state,
                canSendRequest: state === 'ready',
                requestId: existingRequest?.id ?? null,
                inviter: {
                    id: targetUser.id,
                    displayName: targetUser.displayName,
                    selectedIcon: targetUser.selectedIcon,
                    avatarBackground: targetUser.avatarBackground,
                },
                code: targetUser.friendCode ? formatFriendCode(targetUser.friendCode) : null,
            },
        })
    } catch (error) {
        return serverErrorResponse('Error loading friend invite', error)
    }
})

export const POST = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const parsed = await parseBody(request, inviteRotateSchema)
    if (parsed.error) return parsed.error

    try {
        const invite = await rotateFriendInviteIdentity(user.id)
        return jsonResponse({
            invite: {
                code: invite.friendCode ? formatFriendCode(invite.friendCode) : '',
                rawCode: invite.friendCode,
                inviteToken: invite.friendInviteToken,
                allowFriendRequests: invite.allowFriendRequests,
            },
        })
    } catch (error) {
        return serverErrorResponse('Error rotating friend invite', error)
    }
})

export const dynamic = 'force-dynamic'
