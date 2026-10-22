export interface TicketCreatedEvent {
  ticketId: string;
  ticketName: string;
  priority: string;
  categoryId: string;
  reporterId: string;
  reporterName: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  /** The reporter's portal link; every ticket has one. */
  portalToken: string;
  source?: 'ui' | 'email' | 'portal' | 'api';
  mailboxId?: string;
}

export interface TicketAssignedEvent {
  ticketId: string;
  ticketName: string;
  newAssigneeId: string | null;
  previousAssigneeId: string | null;
  /** Who assigned it: nobody is told about an assignment they made to themselves */
  assignedById?: string | null;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

export interface NewCommentEvent {
  ticketId: string;
  ticketName: string;
  ticketNumber?: string;
  commentId: string;
  authorId: string;
  authorName: string;
  commentContent: string;
  assigneeId: string | null;
  mentionedUserIds: string[];
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  mailboxId?: string | null;
}

export interface StatusChangedEvent {
  ticketId: string;
  ticketName: string;
  oldStatus: string;
  newStatus: string;
  changedById: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  /** Set when the change only follows another one people were already told about (an assignment). */
  quiet?: boolean;
}

/** A closed ticket taken back to work: by the team with a reason, or by the requester from the portal. */
export interface TicketReopenedEvent {
  ticketId: string;
  ticketName: string;
  oldStatus: string;
  newStatus: string;
  reopenedById: string;
  byRequester: boolean;
  reason: string;
  /** Seen by the team only: never sent to the requester. */
  note: string;
  previousResolvedById: string | null;
  assigneeId: string | null;
  reopenCount: number;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

export interface TransferRequestCreatedEvent {
  requestId: string;
  ticketId: string;
  ticketName: string;
  requesterId: string;
  requesterName: string;
  targetUserId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  expiresAt: Date;
}

export interface TransferRequestResolvedEvent {
  requestId: string;
  ticketId: string;
  ticketName: string;
  requesterId: string;
  targetUserId: string;
  resolution: 'accepted' | 'rejected' | 'cancelled';
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

/** One edited ticket field. Reference fields (and tags) also carry their display names when known. */
export interface TicketFieldChange {
  field: 'name' | 'description' | 'priority' | 'categoryId' | 'departmentId' | 'organizationId' | 'projectId' | 'tagIds' | 'customFields';
  before: unknown;
  after: unknown;
  beforeLabel?: string;
  afterLabel?: string;
}

/** Emitted after a ticket edit that changed at least one field. Consumed by webhooks only. */
export interface TicketUpdatedEvent {
  ticketId: string;
  ticketNumber: string;
  ticketName: string;
  updatedById: string;
  changes: TicketFieldChange[];
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

/** Emitted after a ticket was deleted (soft delete). Consumed by webhooks only. */
export interface TicketDeletedEvent {
  ticketId: string;
  ticketNumber: string;
  ticketName: string;
  deletedById: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

/**
 * A workspace was deleted, restored, or is about to be purged. Consumed by email only: its owner
 * and admins are told what happened and until when it can be undone.
 */
/** A verified custom domain stopped pointing to the installation (workspace.custom-domain-failing / -distrusted). */
export interface CustomDomainCheckEvent {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  domain: string;
  /** When the checks started failing, ISO. */
  failingSince: string;
}

export interface WorkspaceLifecycleEvent {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  accountId: string | null;
  /** When it will be (or would have been) erased; null after a restore. */
  purgeAt: string | null;
  actorUserId: string | null;
}
