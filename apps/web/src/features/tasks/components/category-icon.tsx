import React from 'react'

const paths: Record<string, React.ReactNode> = {
  'briefcase': <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  'book-open': <><path d="M12 6C9 3 5 3 3 4v14c3-1 6-1 9 2 3-3 6-3 9-2V4c-2-1-6-1-9 2zM12 6v14" /></>,
  'layout': <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
  'user': <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  'heart': <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />,
}

export function CategoryIcon({ icon }: { icon: string }) {
  if (paths[icon]) return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[icon]}</svg>
  // Older categories may store an emoji; unknown icon identifiers have no visual.
  return /[a-z]/i.test(icon) ? null : <span aria-hidden="true">{icon}</span>
}
