/** The languages notices are written in; anything else reads the English one. */
export type NoticeLang = 'en' | 'es';

/** A text in each language, with {placeholders} filled from the notice's data. */
export type NoticeText = Record<NoticeLang, string>;

export type NoticeChannel = 'inApp' | 'email' | 'matrix';

export const NOTICE_CHANNELS: NoticeChannel[] = ['inApp', 'email', 'matrix'];

/**
 * Who a kind of notice goes to: the admins of the workspace it is about, the installation's
 * admins, or the people the sender names (an account's owner, say).
 */
export type NoticeAudience = 'workspace-admins' | 'system-admins' | 'given';

/**
 * A kind of notice that is not about a ticket: someone joined the team, someone signed up, a
 * payment failed… The core brings its own and an extension (cloud) adds more under NOTICE_KINDS,
 * so the core never knows what they are about. Each person turns each channel on or off in their
 * notification settings, unless the kind says the channel cannot be silenced.
 */
export interface NoticeKind {
  /** Stored as the in-app notification's type: kebab-case, never changed once released. */
  key: string;
  audience: NoticeAudience;
  /** Its name in the settings and in the bell. */
  label: NoticeText;
  /** One line under the name in the settings. */
  description: NoticeText;
  /** The notice itself: "{name} joined {workspace} as {role}". */
  headline: NoticeText;
  /** The button in the email and the link in Matrix. */
  action: NoticeText;
  /** In front of the Matrix notice. */
  icon: string;
  /** On for whoever has not chosen yet. */
  defaults: Record<NoticeChannel, boolean>;
  /** Channels it always goes by, whatever the person chose: kept for money and security. */
  mandatory?: NoticeChannel[];
}

/** The kinds an extension adds, provided under this token as NoticeKind[] and looked up with ModuleRef. */
export const NOTICE_KINDS = 'NOTICE_KINDS';

export function noticeLang(lang: string | null | undefined): NoticeLang {
  return lang === 'es' ? 'es' : 'en';
}

/** The data a notice is filled with: plain values, or values that read differently in each language (a role). */
export type NoticeData = Record<string, string | NoticeText>;

/** The text in that language, its placeholders filled; an unknown placeholder is left as it is. */
export function noticeText(text: NoticeText, lang: NoticeLang, data: NoticeData = {}): string {
  return text[lang].replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = data[name];
    if (value === undefined) return match;
    return typeof value === 'string' ? value : value[lang];
  });
}
