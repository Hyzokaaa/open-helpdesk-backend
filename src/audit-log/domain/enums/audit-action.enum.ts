export enum AuditAction {
  // Ticket
  TICKET_CREATED = 'ticket-created',
  TICKET_UPDATED = 'ticket-updated',
  TICKET_STATUS_CHANGED = 'ticket-status-changed',
  TICKET_ASSIGNED = 'ticket-assigned',
  TICKET_PICKED_UP = 'ticket-picked-up',
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
  WORKSPACE_DELETED = 'workspace-deleted',
  WORKSPACE_PALETTE_UPDATED = 'workspace-palette-updated',
  WORKSPACE_SLA_UPDATED = 'workspace-sla-updated',
  WORKSPACE_IMPORT_STARTED = 'workspace-import-started',
  WORKSPACE_MEMBERS_IMPORTED = 'workspace-members-imported',
  WORKSPACE_EXPORT_CREATED = 'workspace-export-created',
  WORKSPACE_SYSTEM_MAILBOX_TOGGLED = 'workspace-system-mailbox-toggled',
  WORKSPACE_CUSTOM_DOMAIN_SET = 'workspace-custom-domain-set',
  WORKSPACE_CUSTOM_DOMAIN_VERIFIED = 'workspace-custom-domain-verified',
  WORKSPACE_CUSTOM_DOMAIN_REMOVED = 'workspace-custom-domain-removed',
  WORKSPACE_BRANDING_UPDATED = 'workspace-branding-updated',
  SYSTEM_BRANDING_UPDATED = 'system-branding-updated',

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

  // Auth
  USER_LOGGED_IN = 'user-logged-in',
  USER_FORGOT_PASSWORD = 'user-forgot-password',
  USER_RESET_PASSWORD = 'user-reset-password',
  USER_EMAIL_VERIFIED = 'user-email-verified',
  USER_OAUTH_LOGIN = 'user-oauth-login',
  USER_RESEND_VERIFICATION = 'user-resend-verification',

  // Mailbox
  MAILBOX_CREATED = 'mailbox-created',
  MAILBOX_UPDATED = 'mailbox-updated',
  MAILBOX_DELETED = 'mailbox-deleted',
  MAILBOX_PAUSED = 'mailbox-paused',
  MAILBOX_RESUMED = 'mailbox-resumed',
  MAILBOX_POLL_TRIGGERED = 'mailbox-poll-triggered',
  MAILBOX_IMPORT_STARTED = 'mailbox-import-started',
  MAILBOX_TEST_CONNECTION = 'mailbox-test-connection',

  // Email system
  IMAP_POLL_STARTED = 'imap-poll-started',
  IMAP_POLL_COMPLETED = 'imap-poll-completed',
  IMAP_POLL_FAILED = 'imap-poll-failed',
  EMAIL_RECEIVED = 'email-received',
  EMAIL_SENT = 'email-sent',
  EMAIL_SEND_FAILED = 'email-send-failed',
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

  // Projects
  PROJECT_CREATED = 'project-created',
  PROJECT_UPDATED = 'project-updated',
  PROJECT_DELETED = 'project-deleted',

  // Ticket Categories
  TICKET_CATEGORY_CREATED = 'ticket-category-created',
  TICKET_CATEGORY_UPDATED = 'ticket-category-updated',
  TICKET_CATEGORY_DELETED = 'ticket-category-deleted',

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
