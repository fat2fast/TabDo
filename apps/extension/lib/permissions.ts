export const FLOATING_PILL_ORIGINS = ['*://*/*', 'https://*/*', 'http://*/*'] as const

/**
 * Checks whether optional host permissions for Floating Pill are currently granted.
 * Supports Edge, Chrome, Brave, and other Chromium browsers reliably.
 */
export async function hasFloatingPillPermissions(): Promise<boolean> {
  if (typeof chrome === 'undefined') return false
  try {
    // 1. Inspect all granted origins directly via getAll()
    if (chrome.permissions?.getAll) {
      const all = await chrome.permissions.getAll().catch(() => null)
      if (all?.origins && Array.isArray(all.origins)) {
        const hasMatch = all.origins.some((o: string) =>
          o === '*://*/*' ||
          o === 'https://*/*' ||
          o === 'http://*/*' ||
          o === '<all_urls>'
        )
        if (hasMatch) return true
      }
    }

    // 2. Fallback to contains() checks individually (never combine in a single array
    // because contains() returns false if any single origin in the array is not present)
    if (chrome.permissions?.contains) {
      const hasWildcard = await chrome.permissions.contains({ origins: ['*://*/*'] }).catch(() => false)
      if (hasWildcard) return true

      const hasAllUrls = await chrome.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false)
      if (hasAllUrls) return true

      const hasHttps = await chrome.permissions.contains({ origins: ['https://*/*'] }).catch(() => false)
      if (hasHttps) return true

      const hasHttp = await chrome.permissions.contains({ origins: ['http://*/*'] }).catch(() => false)
      if (hasHttp) return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Safely requests optional host permissions for Floating Pill.
 */
export async function requestFloatingPillPermissions(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false
  try {
    const granted = await chrome.permissions.request({ origins: ['*://*/*'] }).catch(() => false)
    if (granted) return true
  } catch {
    // ignore
  }
  try {
    const fallback = await chrome.permissions.request({ origins: ['https://*/*', 'http://*/*'] }).catch(() => false)
    if (fallback) return true
  } catch {
    // ignore
  }
  try {
    const httpsOnly = await chrome.permissions.request({ origins: ['https://*/*'] }).catch(() => false)
    if (httpsOnly) return true
  } catch {
    // ignore
  }
  return false
}

/**
 * Revokes ONLY the optional host permissions associated with Floating Pill.
 * Crucially, never touches required Supabase host permissions.
 */
export async function revokeFloatingPillPermissions(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.remove) return false
  try {
    let removedAny = false
    if (chrome.permissions?.getAll) {
      const current = await chrome.permissions.getAll().catch(() => ({ origins: [] }))
      const pillOriginsToRemove = (current.origins || []).filter((o: string) =>
        o === '*://*/*' ||
        o === 'https://*/*' ||
        o === 'http://*/*' ||
        o === '<all_urls>'
      )
      if (pillOriginsToRemove.length > 0) {
        const removed = await chrome.permissions.remove({ origins: pillOriginsToRemove }).catch(() => false)
        if (removed) removedAny = true
      }
    }
    const r1 = await chrome.permissions.remove({ origins: ['*://*/*'] }).catch(() => false)
    const r2 = await chrome.permissions.remove({ origins: ['https://*/*'] }).catch(() => false)
    const r3 = await chrome.permissions.remove({ origins: ['http://*/*'] }).catch(() => false)
    return Boolean(removedAny || r1 || r2 || r3)
  } catch {
    return false
  }
}
