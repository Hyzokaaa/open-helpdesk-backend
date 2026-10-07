/**
 * The part of a webhook URL that the audit log keeps. Some URLs are credentials in themselves
 * (Slack and Discord put the secret in the path), so only the host is recorded; the full URL
 * stays in the webhook's own settings.
 */
export function webhookUrlHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}
