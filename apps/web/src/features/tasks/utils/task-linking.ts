/**
 * Utilities for embedding and parsing linked task IDs in markdown description
 * Format: <!-- tabdo_linked: ["id1", "id2"] -->
 */

const LINKED_METADATA_REGEX = /<!--\s*tabdo_linked:[\s\S]*?-->/gi
const LINKED_EXTRACT_REGEX = /<!--\s*tabdo_linked:\s*(\[[\s\S]*?\])\s*-->/i

export function extractLinkedTaskIds(description: string | null | undefined): string[] {
  if (!description) return []
  const match = LINKED_EXTRACT_REGEX.exec(description)
  if (!match || !match[1]) return []
  try {
    const parsed = JSON.parse(match[1])
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
    }
  } catch {
    // Malformed JSON comment, safely ignore
  }
  return []
}

export function cleanDescriptionWithoutLinks(description: string | null | undefined): string {
  if (!description) return ''
  return description.replace(LINKED_METADATA_REGEX, '').trim()
}

export function embedLinkedTaskIds(
  baseDescription: string,
  linkedIds: string[]
): string {
  const clean = cleanDescriptionWithoutLinks(baseDescription)
  if (!linkedIds || linkedIds.length === 0) {
    return clean
  }
  const tag = `<!-- tabdo_linked: ${JSON.stringify(linkedIds)} -->`
  return clean ? `${clean}\n\n${tag}` : tag
}
