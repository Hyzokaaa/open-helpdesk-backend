import { t } from './i18n';
import { emailLayout } from './base.template';

interface Data {
  ticketName: string;
  workspaceName: string;
  surveyBaseUrl: string;
  lang: string;
}

function ratingButton(label: string, emoji: string, url: string, color: string): string {
  return `<a href="${url}" style="display: inline-block; padding: 12px 24px; margin: 0 6px; background-color: ${color}; color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">${emoji} ${label}</a>`;
}

export class CsatSurveyTemplate {
  subject(data: Data): string {
    return `[${data.workspaceName}] ${t('csat.subject', data.lang)}`;
  }

  html(data: Data): string {
    const content = `
      <h2 style="color: #1f2937; margin-top: 0;">${t('csat.title', data.lang)}</h2>
      <p style="color: #4b5563;">${t('csat.body', data.lang, { ticketName: `<strong>${data.ticketName}</strong>` })}</p>
      <p style="color: #374151; font-weight: bold; margin-top: 24px;">${t('csat.question', data.lang)}</p>
      <div style="text-align: center; margin: 24px 0;">
        ${ratingButton(t('csat.good', data.lang), '😊', `${data.surveyBaseUrl}/good`, '#22c55e')}
        ${ratingButton(t('csat.neutral', data.lang), '😐', `${data.surveyBaseUrl}/neutral`, '#f59e0b')}
        ${ratingButton(t('csat.bad', data.lang), '😞', `${data.surveyBaseUrl}/bad`, '#ef4444')}
      </div>`;
    return emailLayout(data.lang, content);
  }
}
