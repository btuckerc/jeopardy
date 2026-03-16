import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/clerk-auth'
import { jsonResponse, serverErrorResponse, badRequestResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import {
    detectBrowserFamily,
    detectDeviceType,
    detectOperatingSystem,
    normalizeCountryCode,
    normalizeLocale,
    normalizeReferrerHost,
    normalizeRegionCode,
    normalizeTimezone,
    normalizeCampaignValue,
} from '@/lib/user-telemetry'

const SOURCE_MAX_LENGTH = 64
const MEDIUM_MAX_LENGTH = 64
const CAMPAIGN_MAX_LENGTH = 128

function resolveGeoFromHeaders(request: NextRequest) {
    return {
        countryCode: normalizeCountryCode(
            request.headers.get('x-vercel-ip-country')
            || request.headers.get('cf-ipcountry')
            || request.headers.get('x-country-code')
        ),
        regionCode: normalizeRegionCode(
            request.headers.get('x-vercel-ip-country-region')
            || request.headers.get('x-region-code')
        ),
    }
}

/**
 * POST /api/user/activity
 * Record user activity (last online time and current page)
 * Throttled to update at most once per minute per user
 */
export const POST = withInstrumentation(async (request: NextRequest) => {
    try {
        const user = await requireAuth()
        
        const body = await request.json()
        const {
            path,
            locale: rawLocale,
            timezone: rawTimezone,
            referrerHost: rawReferrerHost,
            acquisitionSource: rawAcquisitionSource,
            acquisitionMedium: rawAcquisitionMedium,
            acquisitionCampaign: rawAcquisitionCampaign,
        } = body
        
        if (!path || typeof path !== 'string') {
            return badRequestResponse('path is required and must be a string')
        }

        // Throttle updates: only update if lastOnlineAt is more than 60 seconds ago
        // This prevents excessive database writes while still tracking recent activity
        const now = new Date()
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
        const userAgent = request.headers.get('user-agent')
        const geo = resolveGeoFromHeaders(request)
        const locale = normalizeLocale(rawLocale)
        const timezone = normalizeTimezone(rawTimezone)
        const referrerHost = normalizeReferrerHost(rawReferrerHost)
        const acquisitionSource = normalizeCampaignValue(rawAcquisitionSource, SOURCE_MAX_LENGTH)
        const acquisitionMedium = normalizeCampaignValue(rawAcquisitionMedium, MEDIUM_MAX_LENGTH)
        const acquisitionCampaign = normalizeCampaignValue(rawAcquisitionCampaign, CAMPAIGN_MAX_LENGTH)
        
        // Check current user's lastOnlineAt
        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                lastOnlineAt: true,
                locale: true,
                timezone: true,
                countryCode: true,
                regionCode: true,
                deviceType: true,
                browserFamily: true,
                osFamily: true,
                referrerHost: true,
                acquisitionSource: true,
                acquisitionMedium: true,
                acquisitionCampaign: true,
            }
        })

        const telemetryUpdates: Prisma.UserUpdateInput = {}

        if (locale && locale !== currentUser?.locale) {
            telemetryUpdates.locale = locale
        }

        if (timezone && timezone !== currentUser?.timezone) {
            telemetryUpdates.timezone = timezone
        }

        if (geo.countryCode && geo.countryCode !== currentUser?.countryCode) {
            telemetryUpdates.countryCode = geo.countryCode
        }

        if (geo.regionCode && geo.regionCode !== currentUser?.regionCode) {
            telemetryUpdates.regionCode = geo.regionCode
        }

        const deviceType = detectDeviceType(userAgent)
        if (deviceType !== 'unknown' && deviceType !== currentUser?.deviceType) {
            telemetryUpdates.deviceType = deviceType
        }

        const browserFamily = detectBrowserFamily(userAgent)
        if (browserFamily !== 'unknown' && browserFamily !== currentUser?.browserFamily) {
            telemetryUpdates.browserFamily = browserFamily
        }

        const osFamily = detectOperatingSystem(userAgent)
        if (osFamily !== 'unknown' && osFamily !== currentUser?.osFamily) {
            telemetryUpdates.osFamily = osFamily
        }

        if (!currentUser?.referrerHost && referrerHost) {
            telemetryUpdates.referrerHost = referrerHost
        }

        if (!currentUser?.acquisitionSource && acquisitionSource) {
            telemetryUpdates.acquisitionSource = acquisitionSource
        }

        if (!currentUser?.acquisitionMedium && acquisitionMedium) {
            telemetryUpdates.acquisitionMedium = acquisitionMedium
        }

        if (!currentUser?.acquisitionCampaign && acquisitionCampaign) {
            telemetryUpdates.acquisitionCampaign = acquisitionCampaign
        }

        // Only update if lastOnlineAt is null or more than 1 minute ago
        if (currentUser && currentUser.lastOnlineAt && currentUser.lastOnlineAt > oneMinuteAgo && Object.keys(telemetryUpdates).length === 0) {
            // Too soon to update, but return success anyway
            return jsonResponse({ success: true, skipped: true })
        }

        const data: Prisma.UserUpdateInput = {
            ...telemetryUpdates,
        }

        if (!currentUser?.lastOnlineAt || currentUser.lastOnlineAt <= oneMinuteAgo) {
            data.lastOnlineAt = now
            data.lastSeenPath = path.slice(0, 255)
        }
        
        // Update user's activity
        await prisma.user.update({
            where: { id: user.id },
            data,
        })

        return jsonResponse({ success: true })
    } catch (error) {
        return serverErrorResponse('Failed to record activity', error)
    }
})
