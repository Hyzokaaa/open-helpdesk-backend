export enum NotificationType {
  TICKET_CREATED = 'ticket-created',
  TICKET_ASSIGNED = 'ticket-assigned',
  STATUS_CHANGED = 'status-changed',
  TICKET_UNASSIGNED = 'ticket-unassigned',
  COMMENT_CREATED = 'comment-created',
  /** A team member was mentioned in a comment: told instead of COMMENT_CREATED on that channel. */
  MENTIONED = 'mentioned',
  TRANSFER_REQUEST = 'transfer-request',
  UPGRADE_AVAILABLE = 'upgrade-available',
  INVITATION_EXPIRED = 'invitation-expired',
  /** A customer answered a ticket nobody on the team owns or follows. */
  UNATTENDED_REPLY = 'unattended-reply',
}
