import { t } from './i18n';
import { emailLayout } from './base.template';

interface Data {
  version: string;
  releaseUrl: string;
  lang: string;
}

export class UpgradeAvailableTemplate {
  subject(data: Data): string {
    return t('upgradeAvailable.subject', data.lang, { version: data.version });
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('upgradeAvailable.title', data.lang, { version: data.version })}</h2>
      <p style="color: #4b5563;">${t('upgradeAvailable.body', data.lang, { version: data.version })}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.releaseUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('upgradeAvailable.button', data.lang)}</a>
      </div>
      <p style="color: #9ca3af; font-size: 13px;">${t('upgradeAvailable.disable', data.lang)}</p>`;
    return emailLayout(data.lang, content);
  }
}
