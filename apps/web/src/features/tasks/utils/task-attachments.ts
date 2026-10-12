/**
 * Utilities for task file attachments embedded in markdown description metadata
 * Format: <!-- tabdo_attachments: [...] -->
 */

import type { TaskAttachment } from '@tabdo/types'

export type { TaskAttachment }

const ATTACHMENTS_METADATA_REGEX = /<!--\s*tabdo_attachments:[\s\S]*?-->/gi
const ATTACHMENTS_EXTRACT_REGEX = /<!--\s*tabdo_attachments:\s*(\[[\s\S]*?\])\s*-->/i

export function extractTaskAttachments(description: string | null | undefined): TaskAttachment[] {
  if (!description) return []
  const match = ATTACHMENTS_EXTRACT_REGEX.exec(description)
  if (!match || !match[1]) return []
  try {
    const parsed = JSON.parse(match[1])
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is TaskAttachment =>
          Boolean(item && typeof item === 'object' && item.id && item.name)
      )
    }
  } catch {
    // Malformed JSON comment, safely ignore
  }
  return []
}

export function cleanDescriptionWithoutAttachments(description: string | null | undefined): string {
  if (!description) return ''
  return description.replace(ATTACHMENTS_METADATA_REGEX, '').trim()
}

export function embedTaskAttachments(
  baseDescription: string,
  attachments: TaskAttachment[]
): string {
  const clean = cleanDescriptionWithoutAttachments(baseDescription)
  if (!attachments || attachments.length === 0) {
    return clean
  }
  const tag = `<!-- tabdo_attachments: ${JSON.stringify(attachments)} -->`
  return clean ? `${clean}\n\n${tag}` : tag
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function mergeTaskAttachments(
  normalized: TaskAttachment[],
  legacy: TaskAttachment[]
): TaskAttachment[] {
  const merged: TaskAttachment[] = [...normalized]
  const seenIds = new Set(normalized.map((a) => a.id))
  const seenNames = new Set(normalized.map((a) => `${a.name}-${a.size}`))

  for (const leg of legacy) {
    if (seenIds.has(leg.id)) continue
    if (seenNames.has(`${leg.name}-${leg.size}`)) continue
    merged.push(leg)
  }

  return merged
}
