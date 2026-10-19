import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function verifyPurgeResponse(status: string, body: string): { ok: boolean; message: string } {
  const httpStatus = Number(status)
  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
    return { ok: false, message: 'Purge worker returned a non-2xx HTTP status.' }
  }
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    return { ok: false, message: 'Purge worker returned invalid JSON.' }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, message: 'Purge worker response must be an object.' }
  }
  const r = data as Record<string, unknown>
  for (const field of ['processedCount', 'purgedCount', 'skippedCount', 'errorCount']) {
    if (!Number.isSafeInteger(r[field]) || (r[field] as number) < 0) {
      return { ok: false, message: 'Purge worker response contract invalid: ' + field }
    }
  }
  if (r.success !== true || r.errorCount !== 0 || (r.purgedCount as number) + (r.skippedCount as number) !== r.processedCount) {
    return { ok: false, message: 'Purge worker reported incomplete or inconsistent processing.' }
  }
  if (!Array.isArray(r.errorCategories) || r.errorCategories.length !== 0) {
    return { ok: false, message: 'Purge worker response contains error categories.' }
  }
  return { ok: true, message: 'Purge successful: processed=' + r.processedCount + ', purged=' + r.purgedCount + ', skipped=' + r.skippedCount }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.env.PURGE_RESPONSE_FILE
  const status = process.env.PURGE_HTTP_STATUS || ''
  if (!file) {
    console.error('Missing purge response file.')
    process.exitCode = 1
  } else {
    const result = verifyPurgeResponse(status, readFileSync(file, 'utf8'))
    if (result.ok) console.log(result.message)
    else {
      console.error('::error::' + result.message)
      process.exitCode = 1
    }
  }
}
