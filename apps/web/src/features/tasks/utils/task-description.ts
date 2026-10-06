import { cleanDescriptionWithoutAttachments } from './task-attachments'
import { cleanDescriptionWithoutChecklist } from './task-checklist'
import { cleanDescriptionWithoutLinks } from './task-linking'

/**
 * Strips all hidden metadata comments (checklist, attachments, linked tasks)
 * and legacy markdown checklists, leaving only pure user description text.
 */
export function getCleanTaskDescription(rawDescription: string | null | undefined): string {
  if (!rawDescription) return ''
  const withoutChecklist = cleanDescriptionWithoutChecklist(rawDescription)
  const withoutAttachments = cleanDescriptionWithoutAttachments(withoutChecklist)
  const withoutLinks = cleanDescriptionWithoutLinks(withoutAttachments)
  return withoutLinks.trim()
}
