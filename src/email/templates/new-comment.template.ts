import { t } from './i18n';
import { emailLayout, buttonHtml } from './base.template';
import { escapeHtml } from '../../shared/domain/sanitize-html';
import { singleLineText } from '../../shared/domain/sanitize-plain-text';
import { commentEmailBody } from '../domain/comment-email-body';

export interface CommentEmailFile {
  name: string;
  size: number;
}

interface Data {
  ticketName: string;
  ticketNumber?: string;
  ticketUrl: string;
  authorName: string;
  /** The comment as stored; sanitized here into the email body (see commentEmailBody). */
  commentContent: string;
  /** Files attached to the comment, listed by name; they are opened from the ticket. */
  files?: CommentEmailFile[];
  /** Whether a reply to this email reaches the ticket (a mailbox reads it). */
  canReply: boolean;
  /** Sent to admins and supervisors because nobody on the team owns or follows the ticket. */
  unattended?: boolean;
  workspaceName: string;
  lang: string;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class NewCommentTemplate {
  subject(data: Data): string {
    const ref = data.ticketNumber ? ` — ${data.ticketNumber}` : '';
    return singleLineText(`[${data.workspaceName}] Re: ${data.ticketName}${ref}`);
  }

  html(data: Data): string {
    const files = data.files ?? [];
    const filesHtml = files.length === 0 ? '' : `
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">${t('newComment.files', data.lang)}</p>
      <ul style="color: #4b5563; font-size: 13px; margin: 0 0 16px; padding-left: 18px;">
        ${files.map((f) => `<li>📎 ${escapeHtml(f.name)} <span style="color: #9ca3af;">(${fileSize(f.size)})</span></li>`).join('')}
      </ul>`;
    const footerKey = data.canReply ? 'newComment.footer' : 'newComment.footerNoReply';
    const notice = data.unattended
      ? `<p style="background-color: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin: 0 0 16px;">${t('newComment.unattendedNotice', data.lang)}</p>`
      : '';
    const content = `
      ${notice}
      <p style="color: #4b5563;"><strong>${escapeHtml(data.authorName)}:</strong></p>
      <div style="background-color: white; border-left: 3px solid #059669; padding: 12px 16px; margin: 20px 0; color: #4b5563;">
        ${commentEmailBody(data.commentContent)}
      </div>
      ${filesHtml}
      ${buttonHtml(data.lang, data.ticketUrl)}
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        ${t(footerKey, data.lang, { ticketNumber: escapeHtml(data.ticketNumber ?? ''), workspaceName: escapeHtml(data.workspaceName) })}
      </p>`;
    return emailLayout(data.lang, content, { replyMarker: data.canReply });
  }
}
