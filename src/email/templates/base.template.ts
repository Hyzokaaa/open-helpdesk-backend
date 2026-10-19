import { t } from './i18n';
import { escapeAttr } from '../../shared/domain/sanitize-html';

interface LayoutOptions {
  /**
   * The email can be answered: it opens with the line replies are cut at, so what the customer
   * writes is told apart from the quote of this email in any mail client and language.
   */
  replyMarker?: boolean;
}

export function emailLayout(lang: string, content: string, options: LayoutOptions = {}): string {
  const marker = options.replyMarker
    ? `<div style="color: #9ca3af; font-size: 11px; text-align: center; margin-bottom: 12px;">${t('email.replyMarker', lang)}</div>`
    : '';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    ${marker}
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #059669; margin: 0;">${t('email.header', lang)}</h1>
    </div>
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      ${content}
    </div>
  </div>
</body>
</html>`.trim();
}

/** `url` is the raw URL; it is escaped here for the attribute. */
/**
 * The way to the ticket: its button, or, when there is no link the reader can open, the reminder
 * that replying to the email reaches the ticket (nothing when a reply would not either).
 */
export function ticketActionHtml(lang: string, url: string | null, canReply: boolean): string {
  if (url) return buttonHtml(lang, url);
  if (!canReply) return '';
  return `
<p style="color: #4b5563; text-align: center; margin: 30px 0;">${t('email.replyToAddInfo', lang)}</p>`;
}

export function buttonHtml(lang: string, url: string): string {
  return `
<div style="text-align: center; margin: 30px 0;">
  <a href="${escapeAttr(url)}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('email.viewTicket', lang)}</a>
</div>`;
}
