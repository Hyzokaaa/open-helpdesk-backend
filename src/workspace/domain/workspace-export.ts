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

/**
 * A file carried inside the .ohd archive (format 2), next to the JSON. Since 1.16.
 * `file` is the archive path (`files/<id>`), never a storage key; null when the file was missing
 * from storage at export time, or for files upgraded from an older export, which carried none.
 */
export interface WorkspaceExportFile {
  file: string | null;
  fileName: string;
  mimeType: string;
  size: number | null;
}

/** A file the export should have carried but storage did not have. Since 1.16. */
export interface WorkspaceExportMissingFile {
  kind: 'attachment' | 'organization-logo' | 'workspace-logo' | 'workspace-icon';
  /** The attachment or organization id; the workspace has none in the file. */
  id: string | null;
  fileName: string;
}

/** Since 1.15. */
export interface WorkspaceExportOrganization {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  name: string;
  description: string | null;
  notes: string | null;
  domains: string[];
  createdAt: string;
  /** The logo image, null when the organization has none. Since 1.16. */
  logoFile?: WorkspaceExportFile | null;
}

/** Since 1.15. Soft-deleted departments are not exported. */
export interface WorkspaceExportDepartment {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  name: string;
  description: string | null;
  memberEmails: string[];
  createdAt: string;
}

export interface WorkspaceExportTag {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface WorkspaceExportCategory {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  name: string;
  slug: string;
  color: string;
  createdAt: string;
}

/** Since 1.15. Soft-deleted projects are not exported. */
export interface WorkspaceExportProject {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  name: string;
  description: string | null;
  /** Slugs of the ticket categories linked to the project, resolved like a ticket's category. */
  categorySlugs: string[];
  createdAt: string;
}

export interface WorkspaceExportTicket {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
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
  /** Since 1.15; absent in older files, which import as 'ui'. */
  source?: string;
  /** Origin id of the ticket's mailbox, resolved against `mailboxes`. Since 1.18. */
  mailboxOriginId?: string | null;
  registeredByEmail?: string | null;
  originDate?: string | null;
  descriptionEditedAt?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WorkspaceExportComment {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  content: string;
  ticketId: string;
  /** Null if the author no longer exists; such a comment cannot be imported. */
  authorEmail: string | null;
  mentionedUserIds: string[];
  createdAt: string;
}

/** A past version of a ticket description. Since 1.15. */
export interface WorkspaceExportDescriptionEdit {
  /** Since 1.17; older files carry none and their edits are matched by editor and second. */
  id?: string;
  originId?: string;
  ticketId: string;
  content: string;
  /** Null if the editor no longer exists; such an edit cannot be imported. */
  editedByEmail: string | null;
  createdAt: string;
}

/** A past version of a comment. Since 1.15. */
export interface WorkspaceExportCommentEdit {
  /** Since 1.17; older files carry none and their edits are matched by editor and second. */
  id?: string;
  originId?: string;
  commentId: string;
  content: string;
  /** Null if the editor no longer exists; such an edit cannot be imported. */
  editedByEmail: string | null;
  createdAt: string;
}

export interface WorkspaceExportAttachment {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  /**
   * Archive path of the file's bytes (since 1.16); null when it is not in the file. The import
   * stores the bytes under a new key of its own and skips an attachment without them.
   */
  file?: string | null;
  /** Storage key in the source, written up to 1.15. Never used by the import. */
  s3Key?: string;
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
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface WorkspaceExportCustomField {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
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
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
  name: string;
  slug: string;
  icon: string | null;
  position: number;
  createdAt: string;
}

/** Since 1.15. */
export interface WorkspaceExportKbArticle {
  id: string;
  /** Identity across workspaces: the id this entity had where it was first created. Since 1.17. */
  originId?: string;
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

/**
 * A mailbox of the workspace (never the platform's system mailbox). Since 1.18. The IMAP password
 * travels only in an export made with credentials; the import always creates mailboxes paused.
 */
export interface WorkspaceExportMailbox {
  /** Source id, so audit entries about the mailbox can follow it. */
  id?: string;
  originId: string;
  address: string;
  type: string;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  /** Only in an export made with credentials. */
  imapPass?: string | null;
  encryption: string;
  imapFolder: string | null;
  pollInterval: number | null;
  addressMode: string;
  acceptedAddresses: string[];
  autoReply: boolean;
  postProcessAction: string;
  postProcessFolder: string | null;
}

/** Since 1.18. Action values name source ids (department, category, tags, user, organization). */
export interface WorkspaceExportEmailRule {
  /** Source id, so audit entries about the rule can follow it. */
  id?: string;
  originId: string;
  name: string;
  position: number;
  isActive: boolean;
  conditions: { field: string; operator: string; value: string }[];
  actions: { type: string; value?: string }[];
  /** Origin ids of the mailboxes the rule is limited to; empty means every mailbox. */
  mailboxOriginIds: string[];
}

/** The workspace's own SMTP sender. Since 1.18. */
export interface WorkspaceExportEmailSender {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  /** Only in an export made with credentials. */
  smtpPass?: string;
  smtpFrom: string;
  encryption: string;
  fromName: string | null;
  fromEmail: string | null;
}

/** Since 1.18. The import always creates webhooks inactive. */
export interface WorkspaceExportWebhook {
  /** Source id, so audit entries about the webhook can follow it. */
  id?: string;
  originId: string;
  url: string;
  events: string[];
  /** Only in an export made with credentials. */
  secret?: string;
}

export interface WorkspaceExportData {
  version: string;
  exportedAt: string;
  workspace: {
    name: string;
    description: string;
    slaPolicy: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    /** Branding text. Since 1.15. */
    appName?: string | null;
    appSubtitle?: string | null;
    /** Branding images, null when the workspace has none. Since 1.16. */
    logoFile?: WorkspaceExportFile | null;
    iconFile?: WorkspaceExportFile | null;
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
  /** Since 1.18. API keys are never exported. */
  mailboxes: WorkspaceExportMailbox[];
  emailRules: WorkspaceExportEmailRule[];
  emailSender: WorkspaceExportEmailSender | null;
  webhooks: WorkspaceExportWebhook[];
  customDomain: string | null;
  /** True when the export carries passwords and secrets (mailboxes, email sender, webhooks). Since 1.18. */
  credentialsIncluded: boolean;
  /** Files the source storage no longer had when this export was made. Since 1.16. */
  missingFiles?: WorkspaceExportMissingFile[];
}
