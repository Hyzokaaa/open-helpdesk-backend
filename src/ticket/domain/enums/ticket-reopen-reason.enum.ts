/** Why a closed ticket was reopened. */
export enum TicketReopenReason {
  ISSUE_PERSISTS = 'issue-persists',
  CLOSED_WITHOUT_CONFIRMATION = 'closed-without-confirmation',
  WORK_MISSING = 'work-missing',
  OTHER = 'other',
  /** The requester said, in the portal, that it is not solved. */
  REQUESTER = 'requester',
}
