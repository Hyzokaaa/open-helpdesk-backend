import { NoticeText } from './notice-kind';

/** What a personal Matrix notice tells; the Matrix module words it in each user's language. */
export type MatrixPersonalNoticeKind =
  | 'ticket-created'
  | 'assigned'
  | 'unassigned'
  /** The ticket moved to a status that needs an owner, and has none. */
  | 'needs-assignee'
  | 'status-changed'
  | 'reopened'
  | 'comment'
  | 'mention'
  | 'unattended-reply'
  | 'transfer-request'
  | 'transfer-accepted'
  | 'transfer-rejected'
  | 'transfer-cancelled';

export interface MatrixPersonalNotice {
  kind: MatrixPersonalNoticeKind;
  /** Who did it, when the notice names them (a comment's author, who asks for a transfer). */
  actorName?: string;
  oldStatus?: string;
  newStatus?: string;
}

/** The users whose preferences ask for it on Matrix; the Matrix module sends it to each one's direct chat. */
export interface MatrixPersonalNoticeEvent extends MatrixPersonalNotice {
  userIds: string[];
  ticketId: string;
  workspaceSlug: string;
}

export const MATRIX_PERSONAL_NOTICE_EVENT = 'notification.matrix';

/**
 * A notice that is not about a ticket (a NoticeKind's), to the users who want it on Matrix: sent
 * on its own in each one's direct chat with the workspace's bot, or the installation's when it is
 * about no workspace. Already written in each language; the Matrix module picks the user's.
 */
export interface MatrixStandaloneNoticeEvent {
  /** The kind's key, for the logs. */
  kind: string;
  userIds: string[];
  workspaceId: string | null;
  icon: string;
  headline: NoticeText;
  action: NoticeText;
  /** The page in the app, from its root ("/dashboard/…"). */
  path: string;
}

export const MATRIX_STANDALONE_NOTICE_EVENT = 'notification.matrix.standalone';
