export interface WorkspaceExportUser {
  /** Source user id, so ids carried in the file (mentions, audit) can be mapped. Since 1.14. */
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Null for a user the history refers to who is not a member (since 1.14); not added as a member. */
  role: string | null;
  /** False for an account deactivated in the source. Since 1.15; absent means active. */
  isActive?: boolean;
  /** Source organization of the membership. Since 1.15. */
  organizationId?: string | null;
}

/** Since 1.15. The logo file is not carried. */
export interface WorkspaceExportOrganization {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  domains: string[];
  createdAt: string;
}

/** Since 1.15. Soft-deleted departments are not exported. */
export interface WorkspaceExportDepartment {
  id: string;
  name: string;
  description: string | null;
  memberEmails: string[];
  createdAt: string;
}

export interface WorkspaceExportTag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface WorkspaceExportCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  createdAt: string;
}

/** Since 1.15. Soft-deleted projects are not exported. */
export interface WorkspaceExportProject {
  id: string;
  name: string;
  description: string | null;
  /** Slugs of the ticket categories linked to the project, resolved like a ticket's category. */
  categorySlugs: string[];
  createdAt: string;
}

export interface WorkspaceExportTicket {
  id: string;
  name: string;
  description: string;
  priority: string;
  status: string;
  /** Slug of the ticket's category, resolved against `categories` (and the target workspace) on import. */
  category: string | null;
  reporterEmail: string;
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
  /** Source organization id, resolved against `organizations`. Since 1.15. */
  organizationId?: string | null;
  /** Source department id, resolved against `departments`. Since 1.15. */
  departmentId?: string | null;
  /** Source project id, resolved against `projects`. Since 1.15. */
  projectId?: string | null;
  /** Since 1.15; absent in older files, which import as 'ui'. The mailbox is not carried. */
  source?: string;
  registeredByEmail?: string | null;
  originDate?: string | null;
  descriptionEditedAt?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WorkspaceExportComment {
  id: string;
  content: string;
  ticketId: string;
  /** Null if the author no longer exists; such a comment cannot be imported. */
  authorEmail: string | null;
  mentionedUserIds: string[];
  createdAt: string;
}

/** A past version of a ticket description. Since 1.15. */
export interface WorkspaceExportDescriptionEdit {
  ticketId: string;
  content: string;
  /** Null if the editor no longer exists; such an edit cannot be imported. */
  editedByEmail: string | null;
  createdAt: string;
}

/** A past version of a comment. Since 1.15. */
export interface WorkspaceExportCommentEdit {
  commentId: string;
  content: string;
  /** Null if the editor no longer exists; such an edit cannot be imported. */
  editedByEmail: string | null;
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
  userEmail: string | null;
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
  /** Source id, so audit entries about the response can follow it. Since 1.14. */
  id?: string;
  ticketId: string;
  rating: number | null;
  respondedAt: string | null;
  createdAt: string;
}

/** Since 1.15. */
export interface WorkspaceExportKbCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  position: number;
  createdAt: string;
}

/** Since 1.15. */
export interface WorkspaceExportKbArticle {
  id: string;
  title: string;
  slug: string;
  /** Stored HTML; sanitized again on import. */
  content: string;
  status: string;
  position: number;
  /** Source KB category id, resolved against `kbCategories`. */
  categoryId: string;
  /** Null if the author no longer exists; such an article cannot be imported. */
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface WorkspaceExportAuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  /** Null for system and anonymous (portal) events. */
  userEmail: string | null;
  metadata: Record<string, unknown> | null;
  /** Since 1.14; older files fall back to the column defaults ('ticket', 'info', null). */
  category?: string;
  level?: string;
  source?: string | null;
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
    /** Branding text (not the logo or icon files). Since 1.15. */
    appName?: string | null;
    appSubtitle?: string | null;
  };
  users: WorkspaceExportUser[];
  organizations: WorkspaceExportOrganization[];
  departments: WorkspaceExportDepartment[];
  tags: WorkspaceExportTag[];
  categories: WorkspaceExportCategory[];
  projects: WorkspaceExportProject[];
  tickets: WorkspaceExportTicket[];
  comments: WorkspaceExportComment[];
  descriptionEdits: WorkspaceExportDescriptionEdit[];
  commentEdits: WorkspaceExportCommentEdit[];
  attachments: WorkspaceExportAttachment[];
  participants: WorkspaceExportParticipant[];
  cannedResponses: WorkspaceExportCannedResponse[];
  customFields: WorkspaceExportCustomField[];
  csatResponses: WorkspaceExportCsat[];
  kbCategories: WorkspaceExportKbCategory[];
  kbArticles: WorkspaceExportKbArticle[];
  auditLog: WorkspaceExportAuditEntry[];
}
