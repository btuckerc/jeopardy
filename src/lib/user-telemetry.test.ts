import { describe, expect, it } from 'vitest'
import {
    buildStoredAttribution,
    detectBrowserFamily,
    detectDeviceType,
    detectOperatingSystem,
    extractReferrerHost,
    normalizeCountryCode,
    normalizeLocale,
    normalizeRegionCode,
    parseStoredAttribution,
} from './user-telemetry'

describe('user telemetry helpers', () => {
    it('normalizes locale and geo values', () => {
        expect(normalizeLocale('en_US')).toBe('en-US')
        expect(normalizeCountryCode('us')).toBe('US')
        expect(normalizeRegionCode('ny')).toBe('NY')
        expect(normalizeCountryCode('usa')).toBeUndefined()
    })

    it('extracts external referrer hosts only', () => {
        expect(extractReferrerHost('https://google.com/search?q=trivrdy', 'trivrdy.com')).toBe('google.com')
        expect(extractReferrerHost('https://trivrdy.com/practice', 'trivrdy.com')).toBeUndefined()
        expect(extractReferrerHost('not-a-url', 'trivrdy.com')).toBeUndefined()
    })

    it('parses and sanitizes stored attribution payloads', () => {
        const stored = buildStoredAttribution({
            search: '?utm_source=Google&utm_medium=CPC&utm_campaign=Spring_Launch',
            referrer: 'https://news.ycombinator.com/item?id=1',
            currentHost: 'trivrdy.com',
        })

        expect(stored).toMatchObject({
            acquisitionSource: 'google',
            acquisitionMedium: 'cpc',
            acquisitionCampaign: 'spring_launch',
            referrerHost: 'news.ycombinator.com',
        })

        const parsed = parseStoredAttribution(JSON.stringify(stored))
        expect(parsed).toMatchObject({
            acquisitionSource: 'google',
            acquisitionMedium: 'cpc',
            acquisitionCampaign: 'spring_launch',
            referrerHost: 'news.ycombinator.com',
        })
    })

    it('classifies device, browser, and operating system from user agent', () => {
        const iphoneUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        const chromeUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'

        expect(detectDeviceType(iphoneUa)).toBe('mobile')
        expect(detectBrowserFamily(chromeUa)).toBe('chrome')
        expect(detectOperatingSystem(chromeUa)).toBe('windows')
    })
})
