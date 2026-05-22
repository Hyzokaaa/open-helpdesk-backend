export interface TicketCreatedEvent {
  ticketId: string;
  ticketName: string;
  priority: string;
  category: string;
  creatorId: string;
  creatorName: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

export interface TicketAssignedEvent {
  ticketId: string;
  ticketName: string;
  newAssigneeId: string | null;
  previousAssigneeId: string | null;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

export interface NewCommentEvent {
  ticketId: string;
  ticketName: string;
  commentId: string;
  authorId: string;
  authorName: string;
  commentContent: string;
  assigneeId: string | null;
  mentionedUserIds: string[];
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
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
}
