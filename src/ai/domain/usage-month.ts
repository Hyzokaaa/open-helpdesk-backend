/** The `YYYY-MM` bucket AI usage is counted in. */
export function currentUsageMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
