import { emailLayout } from './base.template';
import { t } from './i18n';
import { SendEmailParams } from '../domain/email.service';

interface Data {
  to: string;
  firstName: string;
  workspaceName: string;
  resetUrl: string;
  lang: string;
}

export function importWelcomeEmail(data: Data): SendEmailParams {
  const content = `
    <h2 style="color: #111; margin-top: 0;">${t('importWelcome.title', data.lang)}</h2>
    <p>${t('importWelcome.body', data.lang, { firstName: data.firstName, workspaceName: data.workspaceName })}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.resetUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('importWelcome.button', data.lang)}</a>
    </div>
    <p style="color: #666; font-size: 13px;">${t('importWelcome.expiry', data.lang)}</p>
  `;

  return {
    to: data.to,
    subject: t('importWelcome.subject', data.lang),
    html: emailLayout(data.lang, content),
  };
}
