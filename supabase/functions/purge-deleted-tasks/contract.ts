/** Safe, platform-independent purge worker contract. Never expose task IDs or secrets. */
export function validateWorkerSecret(provided: string | null, configured: string): boolean {
  return configured.length >= 32 && typeof provided === 'string' && provided.length > 0 && provided === configured
}

export type PurgeResult = {
  success: boolean
  processedCount: number
  purgedCount: number
  skippedCount: number
  errorCount: number
  errorCategories: string[]
}

export function makePurgeResult(
  processedCount: number,
  purgedCount: number,
  errors: string[],
  skippedCount = 0,
): PurgeResult {
  return {
    success: errors.length === 0,
    processedCount,
    purgedCount,
    skippedCount,
    errorCount: errors.length,
    errorCategories: [...new Set(errors)],
  }
}

/** Ensure a Storage object belongs to the exact user/task being purged. */
export function isOwnedObjectPath(path: string | null, userId: string, taskId: string): boolean {
  if (!path) return false
  const segments = path.split('/')
  return segments.length >= 3 && segments[0] === userId && segments[1] === taskId &&
    segments.slice(2).every(segment => segment !== '' && segment !== '.' && segment !== '..')
}
