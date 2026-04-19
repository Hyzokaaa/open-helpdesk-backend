import { t } from './i18n';
import { emailLayout, buttonHtml } from './base.template';

interface Data {
  ticketName: string;
  ticketUrl: string;
  oldStatus: string;
  newStatus: string;
  workspaceName: string;
  lang: string;
}

export class StatusChangedTemplate {
  subject(data: Data): string {
    return `[${data.workspaceName}] ${t('statusChanged.subject', data.lang)}: ${data.ticketName}`;
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('statusChanged.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('statusChanged.body', data.lang, { ticketName: `<strong>${data.ticketName}</strong>` })}</p>
      <div style="margin: 20px 0; text-align: center;">
        <span style="background-color: #e5e7eb; padding: 6px 12px; border-radius: 4px; color: #6b7280;">${data.oldStatus}</span>
        <span style="color: #6b7280; margin: 0 8px;">→</span>
        <span style="background-color: #e9e8ff; padding: 6px 12px; border-radius: 4px; color: #6330f7; font-weight: bold;">${data.newStatus}</span>
      </div>
      ${buttonHtml(data.lang, data.ticketUrl)}`;
    return emailLayout(data.lang, content);
  }
}
