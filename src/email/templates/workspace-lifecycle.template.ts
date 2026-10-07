import { emailLayout } from './base.template';
import { t } from './i18n';
import { escapeAttr, escapeHtml } from '../../shared/domain/sanitize-html';
import { singleLineText } from '../../shared/domain/sanitize-plain-text';

export type WorkspaceLifecycleKind = 'deleted' | 'reminder' | 'restored';

interface Data {
  kind: WorkspaceLifecycleKind;
  workspaceName: string;
  /** The day it will be erased, already formatted for the reader. */
  purgeDate: string | null;
  /** Whether the reader can restore it (its owner); admins are only informed. */
  canRestore: boolean;
  /** Where the owner finds the deleted workspace to restore it. */
  restoreUrl: string;
  lang: string;
}

/** Deletion, last reminder before the purge, and restore of a workspace. */
export class WorkspaceLifecycleTemplate {
  subject(data: Data): string {
    return singleLineText(t(`workspaceLifecycle.${data.kind}.subject`, data.lang, { workspace: data.workspaceName }));
  }

  html(data: Data): string {
    const vars = { workspace: escapeHtml(data.workspaceName), date: escapeHtml(data.purgeDate ?? '') };
    const restore = data.canRestore && data.kind !== 'restored'
      ? `
      <p>${t('workspaceLifecycle.restoreHint', data.lang, vars)}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${escapeAttr(data.restoreUrl)}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">${t('workspaceLifecycle.restoreButton', data.lang)}</a>
      </div>`
      : '';
    const content = `
      <h2 style="color: #111; margin-top: 0;">${t(`workspaceLifecycle.${data.kind}.title`, data.lang, vars)}</h2>
      <p>${t(`workspaceLifecycle.${data.kind}.body`, data.lang, vars)}</p>
      ${restore}
    `;
    return emailLayout(data.lang, content);
  }
}
