import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthenticatedUser, requireAdmin, requireAuth } from './api-utils'
import * as clerkAuth from './clerk-auth'

vi.mock('./clerk-auth', () => ({
    getAppUser: vi.fn(),
    getCurrentClerkPrimaryEmail: vi.fn(),
    canUserAccessAdmin: vi.fn(),
}))

const mockedGetAppUser = vi.mocked(clerkAuth.getAppUser)
const mockedGetCurrentClerkPrimaryEmail = vi.mocked(clerkAuth.getCurrentClerkPrimaryEmail)
const mockedCanUserAccessAdmin = vi.mocked(clerkAuth.canUserAccessAdmin)

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
        mockedGetCurrentClerkPrimaryEmail.mockResolvedValue(null)
        mockedCanUserAccessAdmin.mockImplementation((user) => user.role === 'ADMIN')
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

    it('uses the authoritative admin helper when building the authenticated user', async () => {
        mockedGetAppUser.mockResolvedValue(makeClerkUser({ role: 'USER', email: 'not-admin@example.com' }))
        mockedGetCurrentClerkPrimaryEmail.mockResolvedValue('admin@example.com')
        mockedCanUserAccessAdmin.mockReturnValue(true)

        const user = await getAuthenticatedUser()

        expect(user?.role).toBe('ADMIN')
        expect(mockedCanUserAccessAdmin).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'not-admin@example.com', role: 'USER' }),
            { currentAuthEmail: 'admin@example.com' },
        )
    })
})
