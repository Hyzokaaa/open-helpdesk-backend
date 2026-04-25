import { emailLayout } from './base.template';
import { t } from './i18n';

interface Data {
  firstName: string;
  verificationUrl: string;
  lang: string;
}

export class EmailVerificationTemplate {
  subject(data: Data): string {
    return t('emailVerification.subject', data.lang);
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #111; margin-top: 0;">${t('emailVerification.title', data.lang)}</h2>
      <p>${t('emailVerification.body', data.lang, { firstName: data.firstName })}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.verificationUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('emailVerification.button', data.lang)}</a>
      </div>
      <p style="color: #666; font-size: 13px;">${t('emailVerification.expiry', data.lang)}</p>
      <p style="color: #666; font-size: 13px;">${t('emailVerification.ignore', data.lang)}</p>
    `;
    return emailLayout(data.lang, content);
  }
}
