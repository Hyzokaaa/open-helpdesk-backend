import { t } from './i18n';
import { emailLayout, ticketActionHtml } from './base.template';
import { escapeHtml } from '../../shared/domain/sanitize-html';
import { singleLineText } from '../../shared/domain/sanitize-plain-text';

interface Data {
  ticketName: string;
  /** Null when the reader cannot open the ticket (closed portal, no account): they reply by email */
  ticketUrl: string | null;
  workspaceName: string;
  /** Who reopened it, by name. */
  reopenedBy: string;
  /**
   * For the team: why and what is wrong. Left out for the requester, who only learns that it is
   * being worked on again (the note is the team's).
   */
  team?: { reason: string; note: string; previousResolver: string | null };
  /** Whether a reply to this email reaches the ticket (a mailbox reads it). */
  canReply?: boolean;
  lang: string;
}

export class TicketReopenedTemplate {
  subject(data: Data): string {
    const key = data.team ? 'ticketReopened.subject' : 'ticketReopened.subjectRequester';
    return singleLineText(`[${data.workspaceName}] ${t(key, data.lang)}: ${data.ticketName}`);
  }

  html(data: Data): string {
    const name = `<strong>${escapeHtml(data.ticketName)}</strong>`;
    const team = data.team;
    const body = team
      ? `<p style="color: #4b5563;">${t('ticketReopened.body', data.lang, { ticketName: name, name: escapeHtml(data.reopenedBy) })}</p>
      ${team.previousResolver ? `<p style="color: #4b5563;">${t('ticketReopened.resolvedBy', data.lang, { name: escapeHtml(team.previousResolver) })}</p>` : ''}
      <div style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #d97706; background-color: #fffbeb;">
        <p style="margin: 0 0 6px; color: #92400e; font-weight: bold;">${escapeHtml(t(`reopenReason.${team.reason}`, data.lang))}</p>
        <p style="margin: 0; color: #4b5563; white-space: pre-wrap;">${escapeHtml(team.note)}</p>
      </div>`
      : `<p style="color: #4b5563;">${t('ticketReopened.bodyRequester', data.lang, { ticketName: name })}</p>`;
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t(team ? 'ticketReopened.title' : 'ticketReopened.titleRequester', data.lang)}</h2>
      ${body}
      ${ticketActionHtml(data.lang, data.ticketUrl, !!data.canReply)}`;
    return emailLayout(data.lang, content, { replyMarker: data.canReply });
  }
}
