import { emailLayout } from './base.template';
import { t } from './i18n';
import { SendEmailParams } from '../domain/email.service';
import { escapeAttr, escapeHtml } from '../../shared/domain/sanitize-html';
import { sanitizePlainText } from '../../shared/domain/sanitize-plain-text';

interface Data {
  to: string;
  workspaceName: string;
  inviterName: string;
  invitationUrl: string;
  workspaceUrl: string;
  lang: string;
}

export function invitationEmail(data: Data): SendEmailParams {
  const content = `
    <h2 style="color: #111; margin-top: 0;">${t('invitation.title', data.lang)}</h2>
    <p>${t('invitation.body', data.lang, { inviterName: escapeHtml(data.inviterName), workspaceName: escapeHtml(data.workspaceName) })}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${escapeAttr(data.invitationUrl)}" style="background-color: #6330f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('invitation.button', data.lang)}</a>
    </div>
    <p style="color: #666; font-size: 13px;">${t('invitation.expiry', data.lang)}</p>
    <p style="color: #666; font-size: 13px;">${t('invitation.accessAnytime', data.lang, { workspaceUrl: escapeHtml(data.workspaceUrl) })}</p>
  `;

  return {
    to: data.to,
    subject: sanitizePlainText(t('invitation.subject', data.lang)),
    html: emailLayout(data.lang, content),
  };
}
