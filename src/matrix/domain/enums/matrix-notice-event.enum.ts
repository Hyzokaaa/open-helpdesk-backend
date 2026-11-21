/** What a Matrix room can be told about. */
export enum MatrixNoticeEvent {
  TICKET_CREATED = 'ticket-created',
  TICKET_ASSIGNED = 'ticket-assigned',
  STATUS_CHANGED = 'status-changed',
  /** Every customer reply. */
  CUSTOMER_REPLY = 'customer-reply',
  /** Only customer replies to tickets nobody is assigned to. */
  UNATTENDED_REPLY = 'unattended-reply',
  /** Comments written by the team (admins, supervisors, agents). */
  TEAM_COMMENT = 'team-comment',
  SLA_BREACHED = 'sla-breached',
}

/** What a new room is told about until its admin chooses otherwise. */
export const DEFAULT_MATRIX_NOTICE_EVENTS: MatrixNoticeEvent[] = [
  MatrixNoticeEvent.TICKET_CREATED,
  MatrixNoticeEvent.UNATTENDED_REPLY,
  MatrixNoticeEvent.SLA_BREACHED,
];
