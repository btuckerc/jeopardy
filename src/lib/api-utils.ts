/**
 * API Utilities
 * 
 * Shared utilities for API route handlers including:
 * - Response helpers
 * - Error handling
 * - Authentication helpers (using Clerk)
 * - Validation with Zod
 */

import { NextResponse } from 'next/server'
import { z, ZodError, ZodSchema } from 'zod'
import { getAppUser, type AppUser } from './clerk-auth'
import { UserRole } from '@prisma/client'

// =============================================================================
// Types
// =============================================================================

export interface ApiError {
    error: string
    code?: string
    details?: unknown
}

export interface AuthenticatedUser {
    id: string
    email: string
    role: UserRole
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a successful JSON response
 */
export function jsonResponse<T>(data: T, status = 200): NextResponse<T> {
    return NextResponse.json(data, { status })
}

/**
 * Create an error response
 */
export function errorResponse(
    message: string,
    status = 400,
    code?: string,
    details?: unknown
): NextResponse<ApiError> {
    const error: ApiError = { error: message }
    if (code) error.code = code
    if (details) error.details = details
    
    return NextResponse.json(error, { status })
}

/**
 * Create a 400 Bad Request response
 */
export function badRequestResponse(message = 'Bad request'): NextResponse<ApiError> {
    return errorResponse(message, 400, 'BAD_REQUEST')
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse<ApiError> {
    return errorResponse(message, 401, 'UNAUTHORIZED')
}

/**
 * Create a 403 Forbidden response
 */
export function forbiddenResponse(message = 'Forbidden'): NextResponse<ApiError> {
    return errorResponse(message, 403, 'FORBIDDEN')
}

/**
 * Create a 404 Not Found response
 */
export function notFoundResponse(message = 'Not found'): NextResponse<ApiError> {
    return errorResponse(message, 404, 'NOT_FOUND')
}

/**
 * Create a 500 Internal Server Error response
 */
export function serverErrorResponse(
    message = 'Internal server error',
    error?: unknown
): NextResponse<ApiError> {
    console.error('Server error:', error)
    return errorResponse(message, 500, 'SERVER_ERROR')
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Parse and validate request body with Zod schema
 */
export async function parseBody<T>(
    request: Request,
    schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse<ApiError> }> {
    try {
        const body = await request.json()
        const data = schema.parse(body)
        return { data, error: null }
    } catch (error) {
        if (error instanceof ZodError) {
            return {
                data: null,
                error: errorResponse(
                    'Invalid request body',
                    400,
                    'VALIDATION_ERROR',
                    error.errors
                )
            }
        }
        if (error instanceof SyntaxError) {
            return {
                data: null,
                error: errorResponse('Invalid JSON', 400, 'INVALID_JSON')
            }
        }
        return {
            data: null,
            error: serverErrorResponse('Failed to parse request body', error)
        }
    }
}

/**
 * Parse and validate URL search params with Zod schema
 */
export function parseSearchParams<T>(
    searchParams: URLSearchParams,
    schema: ZodSchema<T, any, any>
): { data: T; error: null } | { data: null; error: NextResponse<ApiError> } {
    try {
        const params: Record<string, string | string[]> = {}
        searchParams.forEach((value, key) => {
            if (params[key]) {
                if (Array.isArray(params[key])) {
                    (params[key] as string[]).push(value)
                } else {
                    params[key] = [params[key] as string, value]
                }
            } else {
                params[key] = value
            }
        })
        
        const data = schema.parse(params)
        return { data, error: null }
    } catch (error) {
        if (error instanceof ZodError) {
            return {
                data: null,
                error: errorResponse(
                    'Invalid query parameters',
                    400,
                    'VALIDATION_ERROR',
                    error.errors
                )
            }
        }
        return {
            data: null,
            error: serverErrorResponse('Failed to parse query parameters', error)
        }
    }
}

// =============================================================================
// Authentication (using Clerk)
// =============================================================================

/**
 * Get the authenticated user from the request (via Clerk)
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
    try {
        const appUser = await getAppUser()
        
        if (!appUser) {
            return null
        }
        
        return {
            id: appUser.id,
            email: appUser.email || '',
            role: appUser.role || 'USER'
        }
    } catch (error) {
        console.error('Error getting authenticated user:', error)
        return null
    }
}

/**
 * Require authentication for a route
 * Returns the user or an error response
 */
export async function requireAuth(): Promise<
    { user: AuthenticatedUser; error: null } | { user: null; error: NextResponse<ApiError> }
> {
    const user = await getAuthenticatedUser()
    
    if (!user) {
        return { user: null, error: unauthorizedResponse() }
    }
    
    return { user, error: null }
}

/**
 * Require admin role for a route
 * Returns the user or an error response
 */
export async function requireAdmin(): Promise<
    { user: AuthenticatedUser; error: null } | { user: null; error: NextResponse<ApiError> }
> {
    const { user, error } = await requireAuth()
    
    if (error) {
        return { user: null, error }
    }
    
    if (user!.role !== 'ADMIN') {
        return { user: null, error: forbiddenResponse('Admin access required') }
    }
    
    return { user: user!, error: null }
}

// =============================================================================
// Common Schemas
// =============================================================================

export const paginationSchema = z.object({
    page: z.string().optional().transform(v => v ? parseInt(v, 10) : 1),
    limit: z.string().optional().transform(v => v ? Math.min(parseInt(v, 10), 100) : 20)
})

export const dateRangeSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional()
})

export const knowledgeCategorySchema = z.enum([
    'GEOGRAPHY_AND_HISTORY',
    'ENTERTAINMENT',
    'ARTS_AND_LITERATURE',
    'SCIENCE_AND_NATURE',
    'SPORTS_AND_LEISURE',
    'GENERAL_KNOWLEDGE'
])

export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD'])
