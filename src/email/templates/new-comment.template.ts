import { t } from './i18n';
import { emailLayout, buttonHtml } from './base.template';
import { escapeHtml } from '../../shared/domain/sanitize-html';
import { sanitizePlainText } from '../../shared/domain/sanitize-plain-text';

interface Data {
  ticketName: string;
  ticketNumber?: string;
  ticketUrl: string;
  authorName: string;
  /** Plain text (see htmlToPlainText); escaped here, newlines become <br>. */
  commentPreview: string;
  workspaceName: string;
  lang: string;
}

export class NewCommentTemplate {
  subject(data: Data): string {
    const ref = data.ticketNumber ? ` — ${data.ticketNumber}` : '';
    return sanitizePlainText(`[${data.workspaceName}] Re: ${data.ticketName}${ref}`);
  }

  html(data: Data): string {
    const content = `
      <p style="color: #4b5563;"><strong>${escapeHtml(data.authorName)}:</strong></p>
      <div style="background-color: white; border-left: 3px solid #059669; padding: 12px 16px; margin: 20px 0; color: #4b5563; white-space: pre-line;">
        ${escapeHtml(data.commentPreview).replace(/\n/g, '<br>')}
      </div>
      ${buttonHtml(data.lang, data.ticketUrl)}
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        ${t('newComment.footer', data.lang, { ticketNumber: escapeHtml(data.ticketNumber ?? ''), workspaceName: escapeHtml(data.workspaceName) })}
      </p>`;
    return emailLayout(data.lang, content);
  }
}
