/**
 * NextAuth.js v4 Configuration
 * 
 * Self-hosted authentication using:
 * - Email magic links (via Nodemailer)
 * - Optional OAuth providers (Google, GitHub)
 * - Prisma adapter for database sessions
 */

import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import type { UserRole } from '@prisma/client'

// Extend the built-in session types
declare module 'next-auth' {
    interface Session {
        user: {
            id: string
            email: string
            name?: string | null
            image?: string | null
            role: UserRole
            displayName?: string | null
            selectedIcon?: string | null
            avatarBackground?: string | null
        }
    }
    
    interface User {
        role: UserRole
        displayName?: string | null
        selectedIcon?: string | null
        avatarBackground?: string | null
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id?: string
        role?: UserRole
        avatarBackground?: string | null
    }
}

// Get admin emails from environment variable (comma-separated list)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

/**
 * Check if an email should have admin role based on ADMIN_EMAILS env var
 */
function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false
    return ADMIN_EMAILS.includes(email.toLowerCase())
}

/**
 * Ensure user has correct admin role based on ADMIN_EMAILS env var
 * This runs on every sign-in to keep roles in sync with config
 */
async function ensureCorrectRole(userId: string, email: string | null | undefined): Promise<UserRole> {
    const shouldBeAdmin = isAdminEmail(email)
    const targetRole: UserRole = shouldBeAdmin ? 'ADMIN' : 'USER'
    
    // Update user role if it doesn't match what it should be
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
    })
    
    if (user && user.role !== targetRole && shouldBeAdmin) {
        // Only auto-promote to admin, never demote (to allow manual admin assignments)
        await prisma.user.update({
            where: { id: userId },
            data: { role: 'ADMIN' }
        })
        console.log(`Auto-promoted ${email} to ADMIN role based on ADMIN_EMAILS config`)
        return 'ADMIN'
    }
    
    return user?.role || 'USER'
}

// Configure providers based on environment
const providers: any[] = []

// Development-only credentials provider (for testing without email)
if (process.env.NODE_ENV === 'development') {
    providers.push(
        CredentialsProvider({
            name: 'Dev Login',
            credentials: {
                email: { label: 'Email', type: 'email', placeholder: 'test@example.com' },
            },
            async authorize(credentials) {
                if (!credentials?.email) return null
                
                // Determine role based on ADMIN_EMAILS env var
                const role: UserRole = isAdminEmail(credentials.email) ? 'ADMIN' : 'USER'
                
                // Find or create user
                let user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                })
                
                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            email: credentials.email,
                            name: credentials.email.split('@')[0],
                            role,
                        },
                    })
                    if (role === 'ADMIN') {
                        console.log(`Created new ADMIN user: ${credentials.email}`)
                    }
                } else {
                    // Ensure existing user has correct role
                    await ensureCorrectRole(user.id, user.email)
                }
                
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: isAdminEmail(user.email) ? 'ADMIN' : user.role,
                    displayName: user.displayName,
                    selectedIcon: user.selectedIcon,
                    avatarBackground: user.avatarBackground,
                }
            },
        })
    )
}

// Email provider (magic links) - available if configured
if (process.env.EMAIL_SERVER_HOST) {
    providers.push(
        EmailProvider({
            server: {
                host: process.env.EMAIL_SERVER_HOST,
                port: Number(process.env.EMAIL_SERVER_PORT) || 587,
                auth: {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.EMAIL_SERVER_PASSWORD,
                },
            },
            from: process.env.EMAIL_FROM || 'noreply@trivrdy.com',
        })
    )
}

// Google OAuth - optional
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
        GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        })
    )
}

// GitHub OAuth - removed (no longer used)

// Use JWT strategy in dev (for credentials), database in prod
const useJwtStrategy = process.env.NODE_ENV === 'development'

export const authOptions: NextAuthOptions = {
    adapter: useJwtStrategy ? undefined : PrismaAdapter(prisma),
    providers,
    session: {
        strategy: useJwtStrategy ? 'jwt' : 'database',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: '/auth/signin',
        signOut: '/auth/signout',
        error: '/auth/error',
        verifyRequest: '/auth/verify-request',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = user.role
                token.displayName = user.displayName
                token.selectedIcon = user.selectedIcon
                token.avatarBackground = user.avatarBackground
            }
            return token
        },
        async session({ session, user, token }) {
            // Get user ID from token or user object
            const userId = token?.id as string || user?.id
            
            if (userId) {
                // Always fetch fresh user data from database to ensure displayName, selectedIcon, and avatarBackground are current
                const dbUser = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        id: true,
                        role: true,
                        displayName: true,
                        selectedIcon: true,
                        avatarBackground: true,
                    }
                })
                
                if (dbUser) {
                    session.user.id = dbUser.id
                    session.user.role = dbUser.role || 'USER'
                    session.user.displayName = dbUser.displayName
                    session.user.selectedIcon = dbUser.selectedIcon
                    session.user.avatarBackground = dbUser.avatarBackground
                }
            }
            
            return session
        },
    },
    events: {
        async createUser({ user }) {
            // Log new user creation
            console.log(`New user created: ${user.email}`)
            
            // Auto-assign admin role if email is in ADMIN_EMAILS
            if (isAdminEmail(user.email)) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { role: 'ADMIN' }
                })
                console.log(`Auto-assigned ADMIN role to ${user.email} based on ADMIN_EMAILS config`)
            }
        },
        async signIn({ user }) {
            // Ensure correct role on every sign-in (handles config changes)
            if (user.id && user.email) {
                await ensureCorrectRole(user.id, user.email)
            }
        },
    },
}

// Export for API route
export default authOptions

// Helper function to get session in server components/API routes
import { getServerSession as getNextAuthServerSession } from 'next-auth'

export async function auth() {
    return getNextAuthServerSession(authOptions)
}

// Alias for compatibility
export const getServerSession = auth

// Helper to check if user is admin
export async function isAdmin(): Promise<boolean> {
    const session = await auth()
    return session?.user?.role === 'ADMIN'
}

// Helper to get current user ID
export async function getCurrentUserId(): Promise<string | null> {
    const session = await auth()
    return session?.user?.id || null
}
