export function formatCompactOverdue(dueAt: string, now = new Date(), locale = 'vi'): string {
  const elapsed = now.getTime() - new Date(dueAt).getTime()
  if (!Number.isFinite(elapsed) || elapsed <= 0) return ''
  const hours = Math.floor(elapsed / 3_600_000)
  if (hours === 0) return locale === 'vi' ? 'Quá hạn: dưới 1 giờ' : 'Overdue: under 1 hour'
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  if (locale === 'vi') return `Quá hạn: ${days ? `${days} ngày ` : ''}${remainingHours ? `${remainingHours} giờ` : ''}`.trim()
  return `Overdue: ${days ? `${days} ${days === 1 ? 'day' : 'days'} ` : ''}${remainingHours ? `${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'}` : ''}`.trim()
}
