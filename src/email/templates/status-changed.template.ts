import { t } from './i18n';
import { emailLayout, ticketActionHtml } from './base.template';
import { escapeHtml } from '../../shared/domain/sanitize-html';
import { singleLineText } from '../../shared/domain/sanitize-plain-text';

interface Data {
  ticketName: string;
  /** Null when the reader cannot open the ticket (closed portal, no account): they reply by email */
  ticketUrl: string | null;
  oldStatus: string;
  newStatus: string;
  workspaceName: string;
  /** Whether a reply to this email reaches the ticket (a mailbox reads it). */
  canReply?: boolean;
  lang: string;
}

export class StatusChangedTemplate {
  subject(data: Data): string {
    return singleLineText(`[${data.workspaceName}] ${t('statusChanged.subject', data.lang)}: ${data.ticketName}`);
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('statusChanged.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('statusChanged.body', data.lang, { ticketName: `<strong>${escapeHtml(data.ticketName)}</strong>` })}</p>
      <div style="margin: 20px 0; text-align: center;">
        <span style="background-color: #e5e7eb; padding: 6px 12px; border-radius: 4px; color: #6b7280;">${t(`status.${data.oldStatus}`, data.lang)}</span>
        <span style="color: #6b7280; margin: 0 8px;">→</span>
        <span style="background-color: #ecfdf5; padding: 6px 12px; border-radius: 4px; color: #059669; font-weight: bold;">${t(`status.${data.newStatus}`, data.lang)}</span>
      </div>
      ${ticketActionHtml(data.lang, data.ticketUrl, !!data.canReply)}`;
    return emailLayout(data.lang, content, { replyMarker: data.canReply });
  }
}
