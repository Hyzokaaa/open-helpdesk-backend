import { emailLayout } from './base.template';
import { t } from './i18n';
import { escapeAttr, escapeHtml } from '../../shared/domain/sanitize-html';
import { singleLineText } from '../../shared/domain/sanitize-plain-text';

export type CustomDomainCheckKind = 'failing' | 'distrusted';

interface Data {
  kind: CustomDomainCheckKind;
  workspaceName: string;
  domain: string;
  /** The day the checks started failing, already formatted for the reader. */
  failingSince: string;
  /** The workspace settings, where the domain is configured. */
  settingsUrl: string;
  lang: string;
}

/** Tells a workspace's admins that its custom domain no longer points to the installation. */
export class CustomDomainCheckTemplate {
  subject(data: Data): string {
    return singleLineText(t(`customDomainCheck.${data.kind}.subject`, data.lang, { domain: data.domain }));
  }

  html(data: Data): string {
    const vars = {
      domain: escapeHtml(data.domain),
      workspace: escapeHtml(data.workspaceName),
      date: escapeHtml(data.failingSince),
    };
    const content = `
      <h2 style="color: #111; margin-top: 0;">${t(`customDomainCheck.${data.kind}.title`, data.lang, vars)}</h2>
      <p>${t(`customDomainCheck.${data.kind}.body`, data.lang, vars)}</p>
      <p>${t('customDomainCheck.fix', data.lang, vars)}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${escapeAttr(data.settingsUrl)}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('customDomainCheck.button', data.lang)}</a>
      </div>
    `;
    return emailLayout(data.lang, content);
  }
}
