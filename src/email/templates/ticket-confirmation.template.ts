import { t } from './i18n';
import { emailLayout } from './base.template';

interface Data {
  ticketName: string;
  portalUrl: string;
  lang: string;
}

export class TicketConfirmationTemplate {
  subject(data: Data): string {
    return `${t('ticketConfirmation.subject', data.lang)} — #${data.ticketName}`;
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('ticketConfirmation.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('ticketConfirmation.body', data.lang)}</p>
      <table style="width: 100%; margin: 20px 0;">
        <tr><td style="color: #6b7280; padding: 4px 0;">${t('ticketConfirmation.fieldTitle', data.lang)}</td><td style="color: #1f2937; font-weight: bold;">${data.ticketName}</td></tr>
      </table>
      <p style="color: #4b5563;">${t('ticketConfirmation.trackInfo', data.lang)}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.portalUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('ticketConfirmation.button', data.lang)}</a>
      </div>
      <p style="color: #9ca3af; font-size: 13px;">${t('ticketConfirmation.updates', data.lang)}</p>`;
    return emailLayout(data.lang, content);
  }
}
