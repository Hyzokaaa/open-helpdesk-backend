import { escapeAttr, escapeHtml } from '../../shared/domain/sanitize-html';
import { MatrixMessageContent } from './matrix-client';
import { MatrixNoticeFile, matrixFileKind } from './matrix-notice-files';

/** One notice, already in the room's language. */
export interface MatrixNotice {
  icon: string;
  /** "New ticket TK-12", "TK-12 assigned to Ana"… */
  headline: string;
  /** The ticket's subject; empty for a notice that is not about a ticket. */
  subject: string;
  /** Short facts, shown on one line: "Priority: high", "Customer: Bob". */
  details: string[];
  /** The start of the ticket's or reply's text, plain; only when the room includes text. */
  excerpt?: string | null;
  link: { url: string; label: string };
}

/**
 * The m.notice for a notice: plain body plus HTML, answering in the ticket's thread when there is
 * one, and asking clients not to preview the link (it would show the login page in every notice).
 */
export function matrixNoticeContent(notice: MatrixNotice, threadRootEventId: string | null): MatrixMessageContent {
  const details = notice.details.filter(Boolean).join(' · ');
  const body = [
    `${notice.icon} ${notice.headline}${notice.subject ? ` · ${notice.subject}` : ''}`,
    details,
    ...(notice.excerpt ? [notice.excerpt.split('\n').map((line) => `> ${line}`).join('\n')] : []),
    notice.link.url,
  ].filter(Boolean).join('\n');

  const html = [
    `${notice.icon} <b>${escapeHtml(notice.headline)}</b>${notice.subject ? ` · ${escapeHtml(notice.subject)}` : ''}`,
    details && escapeHtml(details),
    notice.excerpt ? `<blockquote>${escapeHtml(notice.excerpt).replace(/\n/g, '<br>')}</blockquote>` : '',
    `<a href="${escapeAttr(notice.link.url)}">${escapeHtml(notice.link.label)}</a>`,
  ].filter(Boolean).join('<br>');

  return {
    msgtype: 'm.notice',
    body,
    format: 'org.matrix.custom.html',
    formatted_body: html,
    'com.beeper.linkpreviews': [],
    ...inThread(threadRootEventId),
  };
}

/** A file already uploaded to the homeserver (mxc://…), as an image or a file message in the ticket's thread. */
export function matrixFileContent(file: MatrixNoticeFile, contentUri: string, threadRootEventId: string | null): MatrixMessageContent {
  return {
    msgtype: matrixFileKind(file.mimeType) === 'image' ? 'm.image' : 'm.file',
    body: file.name,
    filename: file.name,
    url: contentUri,
    info: { mimetype: file.mimeType, size: file.size },
    ...inThread(threadRootEventId),
  };
}

/** A short plain notice in the ticket's thread (a file that could not be sent). */
export function matrixThreadNoteContent(text: string, threadRootEventId: string | null): MatrixMessageContent {
  return { msgtype: 'm.notice', body: text, ...inThread(threadRootEventId) };
}

function inThread(threadRootEventId: string | null): MatrixMessageContent {
  if (!threadRootEventId) return {};
  return {
    'm.relates_to': {
      rel_type: 'm.thread',
      event_id: threadRootEventId,
      is_falling_back: true,
      'm.in_reply_to': { event_id: threadRootEventId },
    },
  };
}
