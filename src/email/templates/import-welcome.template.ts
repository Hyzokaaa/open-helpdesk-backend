import { emailLayout } from './base.template';
import { t } from './i18n';
import { SendEmailParams } from '../domain/email.service';
import { escapeAttr, escapeHtml } from '../../shared/domain/sanitize-html';
import { singleLineText } from '../../shared/domain/sanitize-plain-text';

interface Data {
  to: string;
  firstName: string;
  workspaceName: string;
  resetUrl: string;
  workspaceUrl: string;
  lang: string;
}

export function importWelcomeEmail(data: Data): SendEmailParams {
  const content = `
    <h2 style="color: #111; margin-top: 0;">${t('importWelcome.title', data.lang)}</h2>
    <p>${t('importWelcome.body', data.lang, { firstName: escapeHtml(data.firstName), workspaceName: escapeHtml(data.workspaceName) })}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${escapeAttr(data.resetUrl)}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('importWelcome.button', data.lang)}</a>
    </div>
    <p style="color: #666; font-size: 13px;">${t('importWelcome.expiry', data.lang)}</p>
    <p style="color: #666; font-size: 13px;">${t('importWelcome.accessAnytime', data.lang, { workspaceUrl: escapeHtml(data.workspaceUrl) })}</p>
  `;

  return {
    to: data.to,
    subject: singleLineText(t('importWelcome.subject', data.lang)),
    html: emailLayout(data.lang, content),
  };
}
