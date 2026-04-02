export interface SiteAnnouncement {
    id: string
    label: string
    title: string
    body: string
    hiddenPathPrefixes?: string[]
}

// Bump `id` when the copy meaningfully changes so previously dismissed notices can surface again.
export const activeSiteAnnouncement: SiteAnnouncement | null = {
    id: 'service-update-2026-04-01',
    label: 'Service update',
    title: 'Sorry for the recent downtime.',
    body: "I'm considering a move to a more permanent endpoint so trivrdy is more reliable going forward. Thanks for bearing with me.",
    hiddenPathPrefixes: ['/game/', '/play/guest-game/'],
}

export function getSiteAnnouncementStorageKey(id: string) {
    return `trivrdy.site-announcement.dismissed.${id}`
}
