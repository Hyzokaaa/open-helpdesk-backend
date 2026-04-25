import { emailLayout } from './base.template';
import { t } from './i18n';

interface Data {
  firstName: string;
  resetUrl: string;
  lang: string;
}

export class PasswordResetTemplate {
  subject(data: Data): string {
    return t('passwordReset.subject', data.lang);
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #111; margin-top: 0;">${t('passwordReset.title', data.lang)}</h2>
      <p>${t('passwordReset.body', data.lang, { firstName: data.firstName })}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.resetUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('passwordReset.button', data.lang)}</a>
      </div>
      <p style="color: #666; font-size: 13px;">${t('passwordReset.expiry', data.lang)}</p>
      <p style="color: #666; font-size: 13px;">${t('passwordReset.ignore', data.lang)}</p>
    `;
    return emailLayout(data.lang, content);
  }
}
