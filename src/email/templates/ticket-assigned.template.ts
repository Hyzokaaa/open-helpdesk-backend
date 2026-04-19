import { t } from './i18n';
import { emailLayout, buttonHtml } from './base.template';

interface Data {
  ticketName: string;
  ticketUrl: string;
  workspaceName: string;
  lang: string;
}

interface AssignedData extends Data {
  assigneeName: string;
}

export class TicketAssignedTemplate {
  assignedSubject(data: AssignedData): string {
    return `[${data.workspaceName}] ${t('ticketAssigned.subject', data.lang)}: ${data.ticketName}`;
  }

  assignedHtml(data: AssignedData): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('ticketAssigned.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('ticketAssigned.body', data.lang, { assigneeName: `<strong>${data.assigneeName}</strong>`, workspaceName: `<strong>${data.workspaceName}</strong>` })}</p>
      <p style="color: #1f2937; font-weight: bold; font-size: 16px; margin: 20px 0;">${data.ticketName}</p>
      ${buttonHtml(data.lang, data.ticketUrl)}`;
    return emailLayout(data.lang, content);
  }

  unassignedSubject(data: Data): string {
    return `[${data.workspaceName}] ${t('ticketUnassigned.subject', data.lang)}: ${data.ticketName}`;
  }

  unassignedHtml(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('ticketUnassigned.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('ticketUnassigned.body', data.lang, { workspaceName: `<strong>${data.workspaceName}</strong>` })}</p>
      <p style="color: #1f2937; font-weight: bold; font-size: 16px; margin: 20px 0;">${data.ticketName}</p>
      ${buttonHtml(data.lang, data.ticketUrl)}`;
    return emailLayout(data.lang, content);
  }
}
