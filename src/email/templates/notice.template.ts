import { t } from './i18n';
import { emailLayout } from './base.template';
import { escapeAttr, escapeHtml } from '../../shared/domain/sanitize-html';
import { singleLineText } from '../../shared/domain/sanitize-plain-text';

interface Data {
  lang: string;
  /** The notice, already in the reader's language. */
  headline: string;
  action: string;
  url: string;
  /** Sent whatever the reader chose: it says so instead of where to turn it off. */
  mandatory: boolean;
}

/** One email for every kind of notice that is not about a ticket (NoticeKind). */
export class NoticeTemplate {
  subject(data: Data): string {
    return singleLineText(data.headline);
  }

  html(data: Data): string {
    const footer = data.mandatory ? t('notice.mandatory', data.lang) : t('notice.manage', data.lang);
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${escapeHtml(data.headline)}</h2>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${escapeAttr(data.url)}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${escapeHtml(data.action)}</a>
      </div>
      <p style="color: #9ca3af; font-size: 13px;">${footer}</p>`;
    return emailLayout(data.lang, content);
  }
}
