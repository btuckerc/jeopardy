import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthenticatedUser, requireAdmin, requireAuth } from './api-utils'
import * as clerkAuth from './clerk-auth'

vi.mock('./clerk-auth', () => ({
    getAppUser: vi.fn(),
}))

const mockedGetAppUser = vi.mocked(clerkAuth.getAppUser)

function makeClerkUser(overrides: { role?: 'USER' | 'ADMIN'; email?: string } = {}) {
    return {
        id: 'usr_123',
        clerkUserId: 'clerk_123',
        email: overrides.email || 'user@example.com',
        name: 'Test User',
        displayName: 'Test User',
        selectedIcon: null,
        avatarBackground: null,
        role: overrides.role || 'USER',
        image: null,
        hasSeenTour: false,
        tourCompleted: false,
        tourDismissed: false,
        tourDismissedAt: null,
    } as const
}

describe('api-utils', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null when no authenticated user is present', async () => {
        mockedGetAppUser.mockResolvedValue(null)

        const user = await getAuthenticatedUser()
        expect(user).toBeNull()
    })

    it('requires auth for authenticated routes', async () => {
        mockedGetAppUser.mockResolvedValue(null)

        const result = await requireAuth()
        expect(result.user).toBeNull()
        expect(result.error).not.toBeNull()
        expect(result.error?.status).toBe(401)
    })

    it('grants admin access for ADMIN role only', async () => {
        mockedGetAppUser.mockResolvedValue(makeClerkUser({ role: 'USER' }))

        const userResult = await requireAuth()
        const adminResult = await requireAdmin()

        expect(userResult.error).toBeNull()
        expect(adminResult.user).toBeNull()
        expect(adminResult.error?.status).toBe(403)

        mockedGetAppUser.mockResolvedValue(makeClerkUser({ role: 'ADMIN' }))
        const adminApproved = await requireAdmin()
        expect(adminApproved.error).toBeNull()
        expect(adminApproved.user?.id).toBe('usr_123')
        expect(adminApproved.user?.role).toBe('ADMIN')
    })
})
