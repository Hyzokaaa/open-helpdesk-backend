import { t } from './i18n';
import { emailLayout, buttonHtml } from './base.template';

interface CreatedData {
  ticketName: string;
  ticketUrl: string;
  requesterName: string;
  workspaceName: string;
  lang: string;
}

interface ResolvedData {
  ticketName: string;
  ticketUrl: string;
  resolution: 'accepted' | 'rejected' | 'cancelled';
  workspaceName: string;
  lang: string;
}

export class TransferRequestTemplate {
  createdSubject(data: CreatedData): string {
    return `[${data.workspaceName}] ${t('transferRequest.subject', data.lang)}: ${data.ticketName}`;
  }

  createdHtml(data: CreatedData): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('transferRequest.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('transferRequest.body', data.lang, { requesterName: `<strong>${data.requesterName}</strong>`, workspaceName: `<strong>${data.workspaceName}</strong>` })}</p>
      <p style="color: #1f2937; font-weight: bold; font-size: 16px; margin: 20px 0;">${data.ticketName}</p>
      ${buttonHtml(data.lang, data.ticketUrl)}`;
    return emailLayout(data.lang, content);
  }

  resolvedSubject(data: ResolvedData): string {
    return `[${data.workspaceName}] ${t(`transferResolved.subject.${data.resolution}`, data.lang)}: ${data.ticketName}`;
  }

  resolvedHtml(data: ResolvedData): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t(`transferResolved.title.${data.resolution}`, data.lang)}</h2>
      <p style="color: #4b5563;">${t(`transferResolved.body.${data.resolution}`, data.lang, { ticketName: `<strong>${data.ticketName}</strong>`, workspaceName: `<strong>${data.workspaceName}</strong>` })}</p>
      ${buttonHtml(data.lang, data.ticketUrl)}`;
    return emailLayout(data.lang, content);
  }
}
