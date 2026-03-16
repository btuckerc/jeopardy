import { prisma } from '@/lib/prisma'
import { FriendActivityType, FriendRequestStatus, FriendVisibility } from '@prisma/client'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { FRIEND_CODE_ALPHABET, FRIEND_CODE_LENGTH, isFriendCodeCandidate, normalizeFriendCode } from '@/lib/friend-invite'

const PUBLIC_PROFILE_SELECT = Prisma.validator<Prisma.UserSelect>()({
    id: true,
    displayName: true,
    email: true,
    selectedIcon: true,
    avatarBackground: true,
})

const LOOKUP_PROFILE_SELECT = Prisma.validator<Prisma.UserSelect>()({
    ...PUBLIC_PROFILE_SELECT,
    allowFriendRequests: true,
    friendVisibility: true,
    friendCode: true,
})

const FRIEND_PROFILE_SELECT = Prisma.validator<Prisma.UserSelect>()({
    ...PUBLIC_PROFILE_SELECT,
    friendVisibility: true,
    currentStreak: true,
    longestStreak: true,
    lastOnlineAt: true,
    lastSeenPath: true,
    createdAt: true,
})

const REQUEST_PARTICIPANT_SELECT = Prisma.validator<Prisma.UserSelect>()({
    ...PUBLIC_PROFILE_SELECT,
    friendVisibility: true,
})

const FRIEND_SETTINGS_SELECT = Prisma.validator<Prisma.UserSelect>()({
    friendVisibility: true,
    allowFriendRequests: true,
})

const FRIEND_INVITE_SELECT = Prisma.validator<Prisma.UserSelect>()({
    id: true,
    displayName: true,
    selectedIcon: true,
    avatarBackground: true,
    allowFriendRequests: true,
    friendCode: true,
    friendInviteToken: true,
    friendInviteTokenCreatedAt: true,
})

type LookupUser = Prisma.UserGetPayload<{ select: typeof LOOKUP_PROFILE_SELECT }>

interface BlockedProfile {
    id: string
    displayName: string | null
    email: string | null
    selectedIcon: string | null
    avatarBackground: string | null
}

interface FriendshipRecord {
    userId1: string
    userId2: string
}

export type FriendSettings = {
    friendVisibility: FriendVisibility
    allowFriendRequests: boolean
}

export type FriendInviteIdentity = Prisma.UserGetPayload<{ select: typeof FRIEND_INVITE_SELECT }>

type FriendRequestWithUsers = Prisma.FriendRequestGetPayload<{
    include: {
        fromUser: {
            select: typeof REQUEST_PARTICIPANT_SELECT
        }
        toUser: {
            select: typeof REQUEST_PARTICIPANT_SELECT
        }
    }
}>

type FriendProfile = Prisma.UserGetPayload<{ select: typeof FRIEND_PROFILE_SELECT }>

type SocialProfileMaskTarget = {
    id: string
    displayName: string | null
    email: string | null
    selectedIcon: string | null
    avatarBackground: string | null
    friendVisibility: FriendVisibility
}

function maskSocialProfile<T extends SocialProfileMaskTarget>(profile: T): T {
    if (profile.friendVisibility === FriendVisibility.STREAK_ONLY) {
        return {
            ...profile,
            displayName: null,
            email: null,
            selectedIcon: null,
            avatarBackground: null,
        }
    }

    return profile
}

/**
 * Build a stable canonical friendship key to avoid duplicate rows in either direction.
*/
export function canonicalFriendPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a]
}

/**
 * Search for a user by id, email, or unique display name.
 */
export async function findFriendTarget(
    input: string,
    options: { allowUserIdLookup?: boolean } = {},
): Promise<LookupUser | null> {
    const trimmed = input.trim()
    if (!trimmed) {
        return null
    }

    const normalizedFriendCode = normalizeFriendCode(trimmed)
    if (isFriendCodeCandidate(normalizedFriendCode)) {
        const friendCodeResult = await prisma.user.findUnique({
            where: { friendCode: normalizedFriendCode },
            select: LOOKUP_PROFILE_SELECT,
        })

        if (friendCodeResult) {
            return maskSocialProfile(friendCodeResult)
        }
    }

    if (options.allowUserIdLookup) {
        const idResult = await prisma.user.findUnique({
            where: { id: trimmed },
            select: LOOKUP_PROFILE_SELECT,
        })

        if (idResult) {
            return maskSocialProfile(idResult)
        }
    }

    const emailOrDisplayNameResult = await prisma.user.findFirst({
        where: {
            OR: [
                { email: { equals: trimmed, mode: 'insensitive' } },
                { displayName: { equals: trimmed } },
            ],
        },
        select: LOOKUP_PROFILE_SELECT,
    })

    if (!emailOrDisplayNameResult) {
        return null
    }

    return maskSocialProfile(emailOrDisplayNameResult)
}

/**
 * Check if a friendship already exists between two users.
 */
export async function isFriend(userAId: string, userBId: string): Promise<boolean> {
    const existing = await prisma.friendship.findFirst({
        where: {
            OR: [
                {
                    userId1: userAId,
                    userId2: userBId,
                },
                {
                    userId1: userBId,
                    userId2: userAId,
                },
            ],
        },
        select: { id: true },
    })

    if (!existing) {
        return false
    }

    return !(await hasBlockedRelationship(userAId, userBId))
}

/**
 * List friends for a user.
 */
export async function listFriendIds(userId: string): Promise<string[]> {
    const friendships: FriendshipRecord[] = await prisma.friendship.findMany({
        where: {
            OR: [
                { userId1: userId },
                { userId2: userId },
            ],
        },
        select: {
            userId1: true,
            userId2: true,
        },
    })

    const friendIds = friendships.map((friendship) =>
        friendship.userId1 === userId ? friendship.userId2 : friendship.userId1,
    )

    if (friendIds.length === 0) {
        return []
    }

    const blockedRelationships = await prisma.friendBlock.findMany({
        where: {
            OR: [
                {
                    blockerUserId: userId,
                    blockedUserId: { in: friendIds },
                },
                {
                    blockedUserId: userId,
                    blockerUserId: { in: friendIds },
                },
            ],
        },
        select: {
            blockerUserId: true,
            blockedUserId: true,
        },
    })

    const hiddenFriendIds = new Set(
        blockedRelationships.map((block) => (
            block.blockerUserId === userId ? block.blockedUserId : block.blockerUserId
        )),
    )

    return friendIds.filter((friendId) => !hiddenFriendIds.has(friendId))
}

/**
 * Record friend activity for audit/friend feed.
 */
export async function createFriendActivity(params: {
    actorUserId: string
    relatedUserId?: string
    activityType: FriendActivityType
    challengeId?: string
    metadata?: Record<string, unknown>
}) {
    return prisma.friendActivity.create({
        data: {
            actorUserId: params.actorUserId,
            relatedUserId: params.relatedUserId,
            activityType: params.activityType,
            challengeId: params.challengeId,
            metadata: params.metadata ? (params.metadata as unknown as object) : undefined,
        },
    })
}

/**
 * Get a specific pending friend request between two users.
 */
export async function getPendingRequestBetweenUsers(userAId: string, userBId: string) {
    return prisma.friendRequest.findFirst({
        where: {
            status: FriendRequestStatus.PENDING,
            OR: [
                { fromUserId: userAId, toUserId: userBId },
                { fromUserId: userBId, toUserId: userAId },
            ],
        },
    })
}

/**
 * Find any existing friend request between two users.
 */
export async function getRequestBetweenUsers(
    userAId: string,
    userBId: string,
    options: { status?: FriendRequestStatus[] } = {},
) {
    return prisma.friendRequest.findFirst({
        where: {
            OR: [
                {
                    fromUserId: userAId,
                    toUserId: userBId,
                },
                {
                    fromUserId: userBId,
                    toUserId: userAId,
                },
            ],
            ...(options.status ? { status: { in: options.status } } : {}),
        },
        orderBy: [
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
        ],
    })
}

/**
 * Find an existing friend request and eager load participants for API responses.
 */
export async function getRequestBetweenUsersWithUsers(
    userAId: string,
    userBId: string,
    options: { status?: FriendRequestStatus[] } = {},
) {
    return prisma.friendRequest.findFirst({
        where: {
            OR: [
                {
                    fromUserId: userAId,
                    toUserId: userBId,
                },
                {
                    fromUserId: userBId,
                    toUserId: userAId,
                },
            ],
            ...(options.status ? { status: { in: options.status } } : {}),
        },
        include: {
            fromUser: {
                select: REQUEST_PARTICIPANT_SELECT,
            },
            toUser: {
                select: REQUEST_PARTICIPANT_SELECT,
            },
        },
        orderBy: [
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
        ],
    })
}

/**
 * Get a friendship between two users if it exists.
 */
export async function getFriendshipBetweenUsers(userAId: string, userBId: string) {
    return prisma.friendship.findFirst({
        where: {
            OR: [
                {
                    userId1: userAId,
                    userId2: userBId,
                },
                {
                    userId1: userBId,
                    userId2: userAId,
                },
            ],
        },
    })
}

/**
 * Get a friend request for an account and status group.
 */
export async function getFriendRequestsForUser(
    userId: string,
    status: FriendRequestStatus | FriendRequestStatus[],
    blockedUserIds: string[] = [],
): Promise<FriendRequestWithUsers[]> {
    const statuses = Array.isArray(status) ? status : [status]

    const requests = await prisma.friendRequest.findMany({
        where: {
            OR: [
                { fromUserId: userId, status: { in: statuses } },
                { toUserId: userId, status: { in: statuses } },
            ],
            NOT: blockedUserIds.length > 0 ? {
                OR: [
                    {
                        fromUserId: { in: blockedUserIds },
                        toUserId: userId,
                    },
                    {
                        fromUserId: userId,
                        toUserId: { in: blockedUserIds },
                    },
                ],
            } : undefined,
        },
        include: {
            fromUser: {
                select: REQUEST_PARTICIPANT_SELECT,
            },
            toUser: {
                select: REQUEST_PARTICIPANT_SELECT,
            },
        },
        orderBy: { updatedAt: 'desc' },
    })

    return requests.map((request) => ({
        ...request,
        fromUser: maskSocialProfile(request.fromUser),
        toUser: maskSocialProfile(request.toUser),
    }))
}

/**
 * Get full friend list records for a user.
 */
export async function getFriendsForUser(userId: string) {
    const friendships = await prisma.friendship.findMany({
        where: {
            OR: [
                { userId1: userId },
                { userId2: userId },
            ],
        },
        orderBy: { createdAt: 'desc' },
    })

    const friendIdsInOrder = friendships.flatMap((friendship) => (
        friendship.userId1 === userId ? [friendship.userId2] : [friendship.userId1]
    ))

    if (friendIdsInOrder.length === 0) {
        return []
    }

    const blockedRelationships = await prisma.friendBlock.findMany({
        where: {
            OR: [
                {
                    blockerUserId: userId,
                    blockedUserId: { in: friendIdsInOrder },
                },
                {
                    blockedUserId: userId,
                    blockerUserId: { in: friendIdsInOrder },
                },
            ],
        },
        select: {
            blockerUserId: true,
            blockedUserId: true,
        },
    })

    const hiddenFriendIds = new Set(
        blockedRelationships.map((block) => (
            block.blockerUserId === userId ? block.blockedUserId : block.blockerUserId
        )),
    )
    const visibleFriendIds = friendIdsInOrder.filter((friendId) => !hiddenFriendIds.has(friendId))
    if (visibleFriendIds.length === 0) {
        return []
    }

    const friendRows: FriendProfile[] = await prisma.user.findMany({
        where: {
            id: {
                in: visibleFriendIds,
            },
        },
        select: {
            ...FRIEND_PROFILE_SELECT,
        },
    })

    const friendMap = new Map(friendRows.map((friend) => [friend.id, maskSocialProfile(friend)]))
    return visibleFriendIds
        .map((friendId) => friendMap.get(friendId))
        .filter((friend): friend is FriendProfile => !!friend)
}

export async function getFriendSettings(userId: string): Promise<FriendSettings> {
    const settings = await prisma.user.findUnique({
        where: { id: userId },
        select: FRIEND_SETTINGS_SELECT,
    })

    if (!settings) {
        return {
            friendVisibility: FriendVisibility.FULL_PROFILE,
            allowFriendRequests: true,
        }
    }

    return settings
}

export async function setFriendSettings(
    userId: string,
    settings: Partial<FriendSettings>,
): Promise<FriendSettings> {
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            ...(settings.friendVisibility ? { friendVisibility: settings.friendVisibility } : {}),
            ...(typeof settings.allowFriendRequests === 'boolean'
                ? { allowFriendRequests: settings.allowFriendRequests }
                : {}),
        },
        select: {
            ...FRIEND_SETTINGS_SELECT,
        },
    })

    return updated
}

export async function hasBlockedRelationship(userAId: string, userBId: string): Promise<boolean> {
    const existing = await prisma.friendBlock.findFirst({
        where: {
            OR: [
                { blockerUserId: userAId, blockedUserId: userBId },
                { blockerUserId: userBId, blockedUserId: userAId },
            ],
        },
        select: { id: true },
    })

    return !!existing
}

export async function getBlockedUserIdsForUser(userId: string): Promise<string[]> {
    const blocks = await prisma.friendBlock.findMany({
        where: {
            blockerUserId: userId,
        },
        select: {
            blockedUserId: true,
        },
    })

    return blocks.map((block) => block.blockedUserId)
}

export async function getBlockedUsersForUser(userId: string): Promise<BlockedProfile[]> {
    const blockedUserIds = await getBlockedUserIdsForUser(userId)
    if (blockedUserIds.length === 0) {
        return []
    }

    return prisma.user.findMany({
        where: {
            id: {
                in: blockedUserIds,
            },
        },
        select: {
            ...PUBLIC_PROFILE_SELECT,
        },
    })
}

export async function clearFriendshipAndRequests(userAId: string, userBId: string): Promise<void> {
    await prisma.$transaction([
        prisma.friendship.deleteMany({
            where: {
                OR: [
                    { userId1: userAId, userId2: userBId },
                    { userId1: userBId, userId2: userAId },
                ],
            },
        }),
        prisma.friendRequest.deleteMany({
            where: {
                OR: [
                    { fromUserId: userAId, toUserId: userBId },
                    { fromUserId: userBId, toUserId: userAId },
                ],
            },
        }),
    ])
}

export async function clearFriendRequestsBetweenUsers(userAId: string, userBId: string): Promise<void> {
    await prisma.friendRequest.deleteMany({
        where: {
            OR: [
                { fromUserId: userAId, toUserId: userBId },
                { fromUserId: userBId, toUserId: userAId },
            ],
        },
    })
}

function generateFriendCode(): string {
    let nextCode = ''
    while (nextCode.length < FRIEND_CODE_LENGTH) {
        const index = crypto.randomInt(0, FRIEND_CODE_ALPHABET.length)
        nextCode += FRIEND_CODE_ALPHABET[index]
    }

    return nextCode
}

function generateFriendInviteToken(): string {
    return crypto.randomBytes(24).toString('base64url')
}

async function updateUserInviteIdentity(
    userId: string,
    fields: { friendCode?: string; friendInviteToken?: string; friendInviteTokenCreatedAt?: Date },
): Promise<FriendInviteIdentity> {
    return prisma.user.update({
        where: { id: userId },
        data: fields,
        select: FRIEND_INVITE_SELECT,
    })
}

export async function ensureFriendInviteIdentity(userId: string): Promise<FriendInviteIdentity> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const current = await prisma.user.findUnique({
            where: { id: userId },
            select: FRIEND_INVITE_SELECT,
        })

        if (!current) {
            throw new Error('User not found')
        }

        if (current.friendCode && current.friendInviteToken) {
            return current
        }

        try {
            return await updateUserInviteIdentity(userId, {
                ...(current.friendCode ? {} : { friendCode: generateFriendCode() }),
                ...(current.friendInviteToken
                    ? {}
                    : {
                          friendInviteToken: generateFriendInviteToken(),
                          friendInviteTokenCreatedAt: new Date(),
                      }),
            })
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError
                && error.code === 'P2002'
            ) {
                continue
            }

            throw error
        }
    }

    throw new Error('Unable to generate a unique friend invite')
}

export async function rotateFriendInviteIdentity(userId: string): Promise<FriendInviteIdentity> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
            return await updateUserInviteIdentity(userId, {
                friendCode: generateFriendCode(),
                friendInviteToken: generateFriendInviteToken(),
                friendInviteTokenCreatedAt: new Date(),
            })
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError
                && error.code === 'P2002'
            ) {
                continue
            }

            throw error
        }
    }

    throw new Error('Unable to rotate the friend invite')
}

export async function getFriendInviteByToken(token: string): Promise<FriendInviteIdentity | null> {
    const trimmed = token.trim()
    if (!trimmed) {
        return null
    }

    return prisma.user.findUnique({
        where: { friendInviteToken: trimmed },
        select: FRIEND_INVITE_SELECT,
    })
}

export async function getFriendInviteByCode(code: string): Promise<FriendInviteIdentity | null> {
    const normalizedCode = normalizeFriendCode(code)
    if (!isFriendCodeCandidate(normalizedCode)) {
        return null
    }

    return prisma.user.findUnique({
        where: { friendCode: normalizedCode },
        select: FRIEND_INVITE_SELECT,
    })
}
