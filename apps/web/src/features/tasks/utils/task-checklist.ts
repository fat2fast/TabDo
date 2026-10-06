/**
 * Utilities for task checklist items embedded in markdown description metadata
 * Format: <!-- tabdo_checklist: [...] -->
 */

export interface TaskChecklistItem {
  id: string
  text: string
  completed: boolean
}

const CHECKLIST_METADATA_REGEX = /<!--\s*tabdo_checklist:[\s\S]*?-->/gi
const CHECKLIST_EXTRACT_REGEX = /<!--\s*tabdo_checklist:\s*(\[[\s\S]*?\])\s*-->/i

export function extractTaskChecklist(description: string | null | undefined): TaskChecklistItem[] {
  if (!description) return []

  // 1. Check for modern metadata comment
  const match = CHECKLIST_EXTRACT_REGEX.exec(description)
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is TaskChecklistItem =>
            Boolean(item && typeof item === 'object' && item.id && item.text !== undefined)
        )
      }
    } catch {
      // Malformed comment, fallback below
    }
  }

  // 2. Legacy fallback: parse markdown task list if present
  const lines = description.split('\n')
  const legacyItems: TaskChecklistItem[] = []
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- [ ] ')) {
      legacyItems.push({
        id: `chk-legacy-${idx}`,
        text: trimmed.slice(6),
        completed: false,
      })
    } else if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      legacyItems.push({
        id: `chk-legacy-${idx}`,
        text: trimmed.slice(6),
        completed: true,
      })
    }
  })

  return legacyItems
}

export function cleanDescriptionWithoutChecklist(description: string | null | undefined): string {
  if (!description) return ''
  let cleaned = description.replace(CHECKLIST_METADATA_REGEX, '').trim()

  // Also strip legacy ### Checklist and task lines so they don't pollute the description editor
  const lines = cleaned.split('\n')
  const filtered = lines.filter((l) => {
    const t = l.trim()
    if (t === '### Checklist') return false
    if (t.startsWith('- [ ] ') || t.startsWith('- [x] ') || t.startsWith('- [X] ')) return false
    return true
  })

  return filtered.join('\n').trim()
}

export function embedTaskChecklist(
  baseDescription: string,
  checklist: TaskChecklistItem[]
): string {
  const clean = cleanDescriptionWithoutChecklist(baseDescription)
  if (!checklist || checklist.length === 0) {
    return clean
  }
  const tag = `<!-- tabdo_checklist: ${JSON.stringify(checklist)} -->`
  return clean ? `${clean}\n\n${tag}` : tag
}
