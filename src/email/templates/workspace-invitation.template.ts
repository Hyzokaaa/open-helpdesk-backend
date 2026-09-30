import { emailLayout } from './base.template';
import { t } from './i18n';
import { SendEmailParams } from '../domain/email.service';

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
    <p>${t('invitation.body', data.lang, { inviterName: data.inviterName, workspaceName: data.workspaceName })}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.invitationUrl}" style="background-color: #6330f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('invitation.button', data.lang)}</a>
    </div>
    <p style="color: #666; font-size: 13px;">${t('invitation.expiry', data.lang)}</p>
    <p style="color: #666; font-size: 13px;">${t('invitation.accessAnytime', data.lang, { workspaceUrl: data.workspaceUrl })}</p>
  `;

  return {
    to: data.to,
    subject: t('invitation.subject', data.lang),
    html: emailLayout(data.lang, content),
  };
}
