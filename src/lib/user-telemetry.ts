const MAX_LOCALE_LENGTH = 16
const MAX_TIMEZONE_LENGTH = 64
const MAX_HOST_LENGTH = 255
const MAX_SOURCE_LENGTH = 64
const MAX_MEDIUM_LENGTH = 64
const MAX_CAMPAIGN_LENGTH = 128

export const ATTRIBUTION_STORAGE_KEY = 'trivrdy_attribution_v1'

export interface UserTelemetrySnapshot {
    locale?: string
    timezone?: string
    countryCode?: string
    regionCode?: string
    deviceType?: string
    browserFamily?: string
    osFamily?: string
    referrerHost?: string
    acquisitionSource?: string
    acquisitionMedium?: string
    acquisitionCampaign?: string
}

export interface StoredAttribution {
    referrerHost?: string
    acquisitionSource?: string
    acquisitionMedium?: string
    acquisitionCampaign?: string
    capturedAt: string
}

function clamp(value: string, maxLength: number): string {
    return value.slice(0, maxLength)
}

function normalizeSimpleValue(value: string | null | undefined, maxLength: number): string | undefined {
    if (typeof value !== 'string') {
        return undefined
    }

    const trimmed = value.trim()
    if (!trimmed) {
        return undefined
    }

    return clamp(trimmed, maxLength)
}

export function normalizeLocale(value: string | null | undefined): string | undefined {
    const normalized = normalizeSimpleValue(value, MAX_LOCALE_LENGTH)
    if (!normalized) {
        return undefined
    }

    return normalized.replace(/_/g, '-')
}

export function normalizeTimezone(value: string | null | undefined): string | undefined {
    return normalizeSimpleValue(value, MAX_TIMEZONE_LENGTH)
}

export function normalizeCountryCode(value: string | null | undefined): string | undefined {
    const raw = normalizeSimpleValue(value, 8)
    if (!raw) {
        return undefined
    }

    if (raw.length !== 2) {
        return undefined
    }

    const normalized = raw
    if (!normalized) {
        return undefined
    }

    const upper = normalized.toUpperCase()
    return /^[A-Z]{2}$/.test(upper) ? upper : undefined
}

export function normalizeRegionCode(value: string | null | undefined): string | undefined {
    const normalized = normalizeSimpleValue(value, 8)
    if (!normalized) {
        return undefined
    }

    const upper = normalized.toUpperCase()
    return /^[A-Z0-9-]{1,8}$/.test(upper) ? upper : undefined
}

export function normalizeReferrerHost(value: string | null | undefined): string | undefined {
    return normalizeSimpleValue(value, MAX_HOST_LENGTH)?.toLowerCase()
}

export function normalizeCampaignValue(value: string | null | undefined, maxLength: number): string | undefined {
    return normalizeSimpleValue(value, maxLength)?.toLowerCase()
}

export function extractReferrerHost(referrer: string | null | undefined, currentHost?: string | null): string | undefined {
    if (!referrer) {
        return undefined
    }

    try {
        const referrerUrl = new URL(referrer)
        const referrerHost = referrerUrl.host.toLowerCase()
        const normalizedCurrentHost = currentHost?.toLowerCase()

        if (normalizedCurrentHost && referrerHost === normalizedCurrentHost) {
            return undefined
        }

        return normalizeReferrerHost(referrerHost)
    } catch {
        return undefined
    }
}

export function parseAttributionFromSearch(search: string | URLSearchParams): Omit<StoredAttribution, 'capturedAt'> {
    const params = search instanceof URLSearchParams ? search : new URLSearchParams(search)

    return {
        acquisitionSource: normalizeCampaignValue(params.get('utm_source'), MAX_SOURCE_LENGTH),
        acquisitionMedium: normalizeCampaignValue(params.get('utm_medium'), MAX_MEDIUM_LENGTH),
        acquisitionCampaign: normalizeCampaignValue(params.get('utm_campaign'), MAX_CAMPAIGN_LENGTH),
    }
}

export function hasAttributionData(attribution: Partial<StoredAttribution> | undefined): boolean {
    return Boolean(
        attribution?.referrerHost
        || attribution?.acquisitionSource
        || attribution?.acquisitionMedium
        || attribution?.acquisitionCampaign
    )
}

export function detectDeviceType(userAgent: string | null | undefined): string {
    const ua = userAgent?.toLowerCase() || ''

    if (!ua) {
        return 'unknown'
    }

    if (/(bot|crawler|spider|slurp|curl|wget|headless)/i.test(ua)) {
        return 'bot'
    }

    if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
        return 'tablet'
    }

    if (/(iphone|ipod|android.*mobile|windows phone|mobile)/i.test(ua)) {
        return 'mobile'
    }

    return 'desktop'
}

export function detectBrowserFamily(userAgent: string | null | undefined): string {
    const ua = userAgent?.toLowerCase() || ''

    if (!ua) {
        return 'unknown'
    }

    if (ua.includes('edg/')) return 'edge'
    if (ua.includes('opr/') || ua.includes('opera')) return 'opera'
    if (ua.includes('chrome/') && !ua.includes('edg/')) return 'chrome'
    if (ua.includes('firefox/')) return 'firefox'
    if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari'
    if (ua.includes('msie') || ua.includes('trident/')) return 'internet explorer'

    return 'other'
}

export function detectOperatingSystem(userAgent: string | null | undefined): string {
    const ua = userAgent?.toLowerCase() || ''

    if (!ua) {
        return 'unknown'
    }

    if (ua.includes('windows')) return 'windows'
    if (ua.includes('android')) return 'android'
    if (/(iphone|ipad|ipod)/i.test(ua)) return 'ios'
    if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macos'
    if (ua.includes('linux')) return 'linux'
    if (ua.includes('cros')) return 'chromeos'

    return 'other'
}

export function buildStoredAttribution(input: {
    search: string | URLSearchParams
    referrer?: string | null
    currentHost?: string | null
}): StoredAttribution | null {
    const utm = parseAttributionFromSearch(input.search)
    const referrerHost = extractReferrerHost(input.referrer, input.currentHost)

    const result: StoredAttribution = {
        ...utm,
        referrerHost,
        capturedAt: new Date().toISOString(),
    }

    return hasAttributionData(result) ? result : null
}

export function parseStoredAttribution(raw: string | null): StoredAttribution | null {
    if (!raw) {
        return null
    }

    try {
        const parsed = JSON.parse(raw) as Partial<StoredAttribution>

        const attribution: StoredAttribution = {
            referrerHost: normalizeReferrerHost(parsed.referrerHost),
            acquisitionSource: normalizeCampaignValue(parsed.acquisitionSource, MAX_SOURCE_LENGTH),
            acquisitionMedium: normalizeCampaignValue(parsed.acquisitionMedium, MAX_MEDIUM_LENGTH),
            acquisitionCampaign: normalizeCampaignValue(parsed.acquisitionCampaign, MAX_CAMPAIGN_LENGTH),
            capturedAt: typeof parsed.capturedAt === 'string' ? parsed.capturedAt : new Date().toISOString(),
        }

        return hasAttributionData(attribution) ? attribution : null
    } catch {
        return null
    }
}
