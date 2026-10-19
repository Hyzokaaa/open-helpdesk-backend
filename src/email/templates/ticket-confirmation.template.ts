import { t } from './i18n';
import { emailLayout, ticketActionHtml } from './base.template';
import { escapeAttr, escapeHtml } from '../../shared/domain/sanitize-html';
import { singleLineText } from '../../shared/domain/sanitize-plain-text';

interface Data {
  ticketName: string;
  /** The ticket's reference (TK-000042); in the subject so a reply without headers still finds it. */
  ticketNumber?: string;
  /** Where to follow the ticket; null when the reader cannot open it (closed portal, no account) */
  ticketUrl: string | null;
  /** Whether a reply to this email reaches the ticket (a mailbox reads it). */
  canReply?: boolean;
  lang: string;
}

export class TicketConfirmationTemplate {
  subject(data: Data): string {
    const ref = data.ticketNumber ? ` — ${data.ticketNumber}` : '';
    return singleLineText(`${t('ticketConfirmation.subject', data.lang)}: ${data.ticketName}${ref}`);
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('ticketConfirmation.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('ticketConfirmation.body', data.lang)}</p>
      <table style="width: 100%; margin: 20px 0;">
        <tr><td style="color: #6b7280; padding: 4px 0;">${t('ticketConfirmation.fieldTitle', data.lang)}</td><td style="color: #1f2937; font-weight: bold;">${escapeHtml(data.ticketName)}</td></tr>
      </table>
      ${data.ticketUrl ? `<p style="color: #4b5563;">${t('ticketConfirmation.trackInfo', data.lang)}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${escapeAttr(data.ticketUrl)}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('ticketConfirmation.button', data.lang)}</a>
      </div>` : ticketActionHtml(data.lang, null, !!data.canReply)}
      <p style="color: #9ca3af; font-size: 13px;">${t('ticketConfirmation.updates', data.lang)}</p>`;
    return emailLayout(data.lang, content, { replyMarker: data.canReply });
  }
}
