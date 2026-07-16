export interface WorkspaceExportUser {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface WorkspaceExportTag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface WorkspaceExportTicket {
  id: string;
  name: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  creatorEmail: string;
  assigneeEmail: string | null;
  ticketNumber: number;
  customFields: Record<string, unknown>;
  discardReason: string | null;
  portalToken: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  resolvedByEmail: string | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  tagIds: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WorkspaceExportComment {
  id: string;
  content: string;
  ticketId: string;
  authorEmail: string;
  mentionedUserIds: string[];
  createdAt: string;
}

export interface WorkspaceExportAttachment {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  ticketId: string | null;
  commentId: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
}

export interface WorkspaceExportParticipant {
  ticketId: string;
  userEmail: string;
  role: string;
}

export interface WorkspaceExportCannedResponse {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface WorkspaceExportCustomField {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  position: number;
  required: boolean;
  createdAt: string;
}

export interface WorkspaceExportCsat {
  ticketId: string;
  rating: number | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface WorkspaceExportAuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  userEmail: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkspaceExportData {
  version: string;
  exportedAt: string;
  workspace: {
    name: string;
    description: string;
    slaPolicy: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  };
  users: WorkspaceExportUser[];
  tags: WorkspaceExportTag[];
  tickets: WorkspaceExportTicket[];
  comments: WorkspaceExportComment[];
  attachments: WorkspaceExportAttachment[];
  participants: WorkspaceExportParticipant[];
  cannedResponses: WorkspaceExportCannedResponse[];
  customFields: WorkspaceExportCustomField[];
  csatResponses: WorkspaceExportCsat[];
  auditLog: WorkspaceExportAuditEntry[];
}
