import { t } from './i18n';
import { emailLayout, buttonHtml } from './base.template';

interface Data {
  ticketName: string;
  ticketNumber?: number;
  ticketUrl: string;
  authorName: string;
  commentPreview: string;
  workspaceName: string;
  lang: string;
}

export class NewCommentTemplate {
  subject(data: Data): string {
    const ref = data.ticketNumber ? ` — #${data.ticketNumber}` : '';
    return `[${data.workspaceName}] Re: ${data.ticketName}${ref}`;
  }

  html(data: Data): string {
    const content = `
      <p style="color: #4b5563;"><strong>${data.authorName}:</strong></p>
      <div style="background-color: white; border-left: 3px solid #059669; padding: 12px 16px; margin: 20px 0; color: #4b5563; white-space: pre-line;">
        ${data.commentPreview.replace(/\n/g, '<br>')}
      </div>
      ${buttonHtml(data.lang, data.ticketUrl)}
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        ${t('newComment.footer', data.lang, { ticketNumber: data.ticketNumber ? `#${data.ticketNumber}` : '', workspaceName: data.workspaceName })}
      </p>`;
    return emailLayout(data.lang, content);
  }
}
