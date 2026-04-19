import { t } from './i18n';
import { emailLayout, buttonHtml } from './base.template';

interface Data {
  ticketName: string;
  ticketUrl: string;
  authorName: string;
  commentPreview: string;
  workspaceName: string;
  lang: string;
}

export class NewCommentTemplate {
  subject(data: Data): string {
    return `[${data.workspaceName}] ${t('newComment.subject', data.lang)}: ${data.ticketName}`;
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('newComment.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('newComment.body', data.lang, { authorName: `<strong>${data.authorName}</strong>`, ticketName: `<strong>${data.ticketName}</strong>` })}</p>
      <div style="background-color: white; border-left: 3px solid #6330f7; padding: 12px 16px; margin: 20px 0; color: #4b5563;">
        ${data.commentPreview}
      </div>
      ${buttonHtml(data.lang, data.ticketUrl)}`;
    return emailLayout(data.lang, content);
  }
}
