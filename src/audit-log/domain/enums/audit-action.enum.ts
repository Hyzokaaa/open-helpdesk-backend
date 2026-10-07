export enum AuditAction {
  // Ticket
  TICKET_CREATED = 'ticket-created',
  TICKET_UPDATED = 'ticket-updated',
  TICKET_STATUS_CHANGED = 'ticket-status-changed',
  TICKET_ASSIGNED = 'ticket-assigned',
  TICKET_PICKED_UP = 'ticket-picked-up',
  /** Never emitted: transfers are recorded as transfer-request-* entries. */
  TICKET_TRANSFERRED = 'ticket-transferred',
  TICKET_DELETED = 'ticket-deleted',

  // Transfer requests
  TRANSFER_REQUEST_CREATED = 'transfer-request-created',
  TRANSFER_REQUEST_ACCEPTED = 'transfer-request-accepted',
  TRANSFER_REQUEST_REJECTED = 'transfer-request-rejected',
  TRANSFER_REQUEST_CANCELLED = 'transfer-request-cancelled',
  TRANSFER_REQUEST_EXPIRED = 'transfer-request-expired',

  // Comment
  COMMENT_CREATED = 'comment-created',
  COMMENT_EDITED = 'comment-edited',

  // Workspace
  WORKSPACE_CREATED = 'workspace-created',
  WORKSPACE_UPDATED = 'workspace-updated',
  /** Deleted and recoverable until its purge date (older entries: erased at once). */
  WORKSPACE_DELETED = 'workspace-deleted',
  WORKSPACE_RESTORED = 'workspace-restored',
  /** Erased for good with all its data and files, by the scheduler or a system admin. */
  WORKSPACE_PURGED = 'workspace-purged',
  WORKSPACE_PALETTE_UPDATED = 'workspace-palette-updated',
  WORKSPACE_SLA_UPDATED = 'workspace-sla-updated',
  /** No longer emitted: older entries were written after an import finished. See WORKSPACE_IMPORT_COMPLETED. */
  WORKSPACE_IMPORT_STARTED = 'workspace-import-started',
  WORKSPACE_IMPORT_COMPLETED = 'workspace-import-completed',
  WORKSPACE_IMPORT_FAILED = 'workspace-import-failed',
  WORKSPACE_MEMBERS_IMPORTED = 'workspace-members-imported',
  WORKSPACE_EXPORTED = 'workspace-exported',
  /** An export link was created; the file itself is built when the link is downloaded. */
  WORKSPACE_EXPORT_CREATED = 'workspace-export-created',
  WORKSPACE_EXPORT_LINK_DOWNLOADED = 'workspace-export-link-downloaded',
  WORKSPACE_SYSTEM_MAILBOX_TOGGLED = 'workspace-system-mailbox-toggled',
  WORKSPACE_CUSTOM_DOMAIN_SET = 'workspace-custom-domain-set',
  WORKSPACE_CUSTOM_DOMAIN_VERIFIED = 'workspace-custom-domain-verified',
  /** A DNS check that did not pass; says which record was missing. */
  WORKSPACE_CUSTOM_DOMAIN_VERIFICATION_FAILED = 'workspace-custom-domain-verification-failed',
  WORKSPACE_CUSTOM_DOMAIN_REMOVED = 'workspace-custom-domain-removed',
  WORKSPACE_BRANDING_UPDATED = 'workspace-branding-updated',
  WORKSPACE_LOGO_UPDATED = 'workspace-logo-updated',
  WORKSPACE_LOGO_REMOVED = 'workspace-logo-removed',
  WORKSPACE_ANALYTICS_UPDATED = 'workspace-analytics-updated',
  SYSTEM_BRANDING_UPDATED = 'system-branding-updated',
  /** The installation's logo or icon; an SVG is accepted, so a change is worth knowing about. */
  SYSTEM_LOGO_UPDATED = 'system-logo-updated',
  SYSTEM_LOGO_REMOVED = 'system-logo-removed',

  // Members
  MEMBER_ADDED = 'member-added',
  MEMBER_REMOVED = 'member-removed',
  MEMBER_ROLE_CHANGED = 'member-role-changed',

  // Invitations
  INVITATION_CREATED = 'invitation-created',
  INVITATION_BATCH_CREATED = 'invitation-batch-created',
  INVITATION_RESENT = 'invitation-resent',
  INVITATION_CANCELLED = 'invitation-cancelled',
  INVITATION_ACCEPTED = 'invitation-accepted',
  INVITATION_REJECTED = 'invitation-rejected',

  // User
  USER_CREATED = 'user-created',
  USER_ACTIVATED = 'user-activated',
  USER_DEACTIVATED = 'user-deactivated',
  USER_ADMIN_TOGGLED = 'user-admin-toggled',
  USER_SIGNED_UP = 'user-signed-up',
  USER_NAME_UPDATED = 'user-name-updated',
  USER_LANGUAGE_CHANGED = 'user-language-changed',
  USER_THEME_CHANGED = 'user-theme-changed',
  USER_DATE_FORMAT_CHANGED = 'user-date-format-changed',
  USER_TIMEZONE_CHANGED = 'user-timezone-changed',
  USER_PASSWORD_CHANGED = 'user-password-changed',
  /** The current password given was wrong. */
  USER_PASSWORD_CHANGE_FAILED = 'user-password-change-failed',
  /** A system admin changed someone's email address. */
  USER_EMAIL_CHANGED = 'user-email-changed',

  // Auth
  USER_LOGGED_IN = 'user-logged-in',
  /** Any failed sign-in, for an existing account or not; the reason is kept only here. */
  USER_LOGIN_FAILED = 'user-login-failed',
  USER_FORGOT_PASSWORD = 'user-forgot-password',
  USER_RESET_PASSWORD = 'user-reset-password',
  USER_PASSWORD_RESET_FAILED = 'user-password-reset-failed',
  USER_EMAIL_VERIFIED = 'user-email-verified',
  USER_OAUTH_LOGIN = 'user-oauth-login',
  USER_OAUTH_LOGIN_FAILED = 'user-oauth-login-failed',
  /** An API key exchanged an email for a session (POST /api/v1/auth/exchange). */
  API_SESSION_EXCHANGED = 'api-session-exchanged',
  /** A request refused for lack of permission, recorded by the exception filter. */
  PERMISSION_DENIED = 'permission-denied',
  USER_RESEND_VERIFICATION = 'user-resend-verification',

  // Mailbox
  MAILBOX_CREATED = 'mailbox-created',
  MAILBOX_UPDATED = 'mailbox-updated',
  MAILBOX_DELETED = 'mailbox-deleted',
  MAILBOX_PAUSED = 'mailbox-paused',
  MAILBOX_RESUMED = 'mailbox-resumed',
  MAILBOX_POLL_TRIGGERED = 'mailbox-poll-triggered',
  /** No longer emitted: older entries were written after the import finished. See MAILBOX_IMPORTED. */
  MAILBOX_IMPORT_STARTED = 'mailbox-import-started',
  /** A manual import of past mail finished, with how many messages it handled. */
  MAILBOX_IMPORTED = 'mailbox-imported',
  MAILBOX_TEST_CONNECTION = 'mailbox-test-connection',

  // Email system
  /** No longer emitted: two entries per poll buried everything else. */
  IMAP_POLL_STARTED = 'imap-poll-started',
  /** Only for a poll that brought mail, or the first one to succeed after failures. */
  IMAP_POLL_COMPLETED = 'imap-poll-completed',
  /** Only when a mailbox starts failing or its error changes, not on every retry. */
  IMAP_POLL_FAILED = 'imap-poll-failed',
  /** A fetched message that could not be routed; it is not retried. */
  EMAIL_PROCESSING_FAILED = 'email-processing-failed',
  EMAIL_RECEIVED = 'email-received',
  EMAIL_SENT = 'email-sent',
  EMAIL_SEND_FAILED = 'email-send-failed',
  /** Never emitted: each message is recorded as email-received on its mailbox. */
  INBOUND_EMAIL_PROCESSED = 'inbound-email-processed',

  // Email sender config
  EMAIL_SENDER_CONFIGURED = 'email-sender-configured',
  EMAIL_SENDER_DELETED = 'email-sender-deleted',
  EMAIL_SENDER_TEST_CONNECTION = 'email-sender-test-connection',

  // Custom fields
  CUSTOM_FIELD_CREATED = 'custom-field-created',
  CUSTOM_FIELD_UPDATED = 'custom-field-updated',
  CUSTOM_FIELD_DELETED = 'custom-field-deleted',
  CUSTOM_FIELD_REORDERED = 'custom-field-reordered',

  // Tags
  TAG_CREATED = 'tag-created',
  TAG_DELETED = 'tag-deleted',

  // Departments
  DEPARTMENT_CREATED = 'department-created',
  DEPARTMENT_UPDATED = 'department-updated',
  DEPARTMENT_DELETED = 'department-deleted',
  DEPARTMENT_MEMBER_ADDED = 'department-member-added',
  DEPARTMENT_MEMBER_REMOVED = 'department-member-removed',

  // Organizations
  ORGANIZATION_CREATED = 'organization-created',
  ORGANIZATION_UPDATED = 'organization-updated',
  ORGANIZATION_DELETED = 'organization-deleted',
  ORGANIZATION_MEMBER_ADDED = 'organization-member-added',
  ORGANIZATION_MEMBER_REMOVED = 'organization-member-removed',
  /** A member moved to another organization (or out of one) from the member list. */
  MEMBER_ORGANIZATION_CHANGED = 'member-organization-changed',
  ORGANIZATION_LOGO_UPDATED = 'organization-logo-updated',
  ORGANIZATION_LOGO_REMOVED = 'organization-logo-removed',

  // Projects
  PROJECT_CREATED = 'project-created',
  PROJECT_UPDATED = 'project-updated',
  PROJECT_DELETED = 'project-deleted',
  PROJECT_CATEGORY_LINKED = 'project-category-linked',
  PROJECT_CATEGORY_UNLINKED = 'project-category-unlinked',

  // Ticket Categories
  TICKET_CATEGORY_CREATED = 'ticket-category-created',
  TICKET_CATEGORY_UPDATED = 'ticket-category-updated',
  TICKET_CATEGORY_DELETED = 'ticket-category-deleted',

  // Email rules
  EMAIL_RULE_CREATED = 'email-rule-created',
  EMAIL_RULE_UPDATED = 'email-rule-updated',
  EMAIL_RULE_DELETED = 'email-rule-deleted',
  EMAIL_RULE_REORDERED = 'email-rule-reordered',

  // Canned responses
  CANNED_RESPONSE_CREATED = 'canned-response-created',
  CANNED_RESPONSE_UPDATED = 'canned-response-updated',
  CANNED_RESPONSE_DELETED = 'canned-response-deleted',

  // Webhooks
  WEBHOOK_CREATED = 'webhook-created',
  WEBHOOK_UPDATED = 'webhook-updated',
  WEBHOOK_DELETED = 'webhook-deleted',

  // API keys
  API_KEY_CREATED = 'api-key-created',
  API_KEY_DELETED = 'api-key-deleted',

  // Knowledge base
  KB_CATEGORY_CREATED = 'kb-category-created',
  KB_CATEGORY_UPDATED = 'kb-category-updated',
  KB_CATEGORY_DELETED = 'kb-category-deleted',
  KB_CATEGORY_REORDERED = 'kb-category-reordered',
  KB_ARTICLE_CREATED = 'kb-article-created',
  KB_ARTICLE_UPDATED = 'kb-article-updated',
  KB_ARTICLE_DELETED = 'kb-article-deleted',
  KB_ARTICLE_REORDERED = 'kb-article-reordered',

  // System config
  SYSTEM_EMAIL_SETTINGS_CONFIGURED = 'system-email-settings-configured',
  SYSTEM_EMAIL_SETTINGS_DELETED = 'system-email-settings-deleted',
  SYSTEM_EMAIL_TEST_CONNECTION = 'system-email-test-connection',
  SYSTEM_MAILBOX_CONFIGURED = 'system-mailbox-configured',
  SYSTEM_MAILBOX_DELETED = 'system-mailbox-deleted',
  SYSTEM_MAILBOX_TEST_CONNECTION = 'system-mailbox-test-connection',
  SYSTEM_ANALYTICS_UPDATED = 'system-analytics-updated',
  /** A system admin sent an arbitrary email through the installation's own sender. */
  SYSTEM_ADMIN_EMAIL_SENT = 'system-admin-email-sent',
  SYSTEM_NOTIFICATION_SETTINGS_UPDATED = 'system-notification-settings-updated',
  WORKSPACE_CREATION_POLICY_UPDATED = 'workspace-creation-policy-updated',

  // Notifications
  NOTIFICATION_PREFERENCES_UPDATED = 'notification-preferences-updated',

  // CSAT
  CSAT_RATING_SUBMITTED = 'csat-rating-submitted',

  // SLA
  SLA_FIRST_RESPONSE_BREACHED = 'sla-first-response-breached',
  SLA_RESOLUTION_BREACHED = 'sla-resolution-breached',

  // Portal
  PORTAL_TICKET_CREATED = 'portal-ticket-created',
  PORTAL_COMMENT_CREATED = 'portal-comment-created',

  // Attachments
  ATTACHMENT_UPLOADED = 'attachment-uploaded',
  ATTACHMENT_DELETED = 'attachment-deleted',

  // Participants
  PARTICIPANT_ADDED = 'participant-added',
  PARTICIPANT_REMOVED = 'participant-removed',
}
