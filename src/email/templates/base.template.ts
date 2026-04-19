import { t } from './i18n';

export function emailLayout(lang: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #6330f7; margin: 0;">${t('email.header', lang)}</h1>
    </div>
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      ${content}
    </div>
  </div>
</body>
</html>`.trim();
}

export function buttonHtml(lang: string, url: string): string {
  return `
<div style="text-align: center; margin: 30px 0;">
  <a href="${url}" style="background-color: #6330f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('email.viewTicket', lang)}</a>
</div>`;
}
