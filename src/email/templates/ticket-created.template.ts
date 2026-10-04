import { t } from './i18n';
import { emailLayout, buttonHtml } from './base.template';
import { escapeHtml } from '../../shared/domain/sanitize-html';
import { sanitizePlainText } from '../../shared/domain/sanitize-plain-text';


interface Data {
  ticketName: string;
  ticketUrl: string;
  reporterName: string;
  priority: string;
  /** The category's display name; empty hides the row. */
  category: string;
  workspaceName: string;
  lang: string;
}

export class TicketCreatedTemplate {
  subject(data: Data): string {
    return sanitizePlainText(`[${data.workspaceName}] ${t('ticketCreated.subject', data.lang)}: ${data.ticketName}`);
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('ticketCreated.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('ticketCreated.body', data.lang, { reporterName: `<strong>${escapeHtml(data.reporterName)}</strong>`, workspaceName: `<strong>${escapeHtml(data.workspaceName)}</strong>` })}</p>
      <table style="width: 100%; margin: 20px 0;">
        <tr><td style="color: #6b7280; padding: 4px 0;">${t('ticketCreated.fieldTitle', data.lang)}</td><td style="color: #1f2937; font-weight: bold;">${escapeHtml(data.ticketName)}</td></tr>
        <tr><td style="color: #6b7280; padding: 4px 0;">${t('ticketCreated.fieldPriority', data.lang)}</td><td style="color: #1f2937;">${t(`priority.${data.priority}`, data.lang)}</td></tr>
        ${data.category ? `<tr><td style="color: #6b7280; padding: 4px 0;">${t('ticketCreated.fieldCategory', data.lang)}</td><td style="color: #1f2937;">${escapeHtml(data.category)}</td></tr>` : ''}
      </table>
      ${buttonHtml(data.lang, data.ticketUrl)}`;
    return emailLayout(data.lang, content);
  }
}
