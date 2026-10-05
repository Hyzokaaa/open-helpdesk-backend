/**
 * Entity types recorded in workspace_import_links. A link says that the entity `targetId` of a
 * workspace is the one a file called `sourceId` (its origin id), whether the import created it or
 * matched an entity already there. The values name the table rows, as the audit entity types do.
 */
export const IMPORT_LINK_TYPES = {
  ticket: 'ticket',
  comment: 'comment',
  attachment: 'attachment',
  descriptionEdit: 'ticket-description-edit',
  commentEdit: 'comment-edit',
  organization: 'organization',
  department: 'department',
  project: 'project',
  category: 'ticket-category',
  tag: 'tag',
  customField: 'custom-field',
  cannedResponse: 'canned-response',
  kbCategory: 'kb-category',
  kbArticle: 'kb-article',
  mailbox: 'mailbox',
  emailRule: 'email-rule',
  webhook: 'webhook',
} as const;

export type ImportLinkType = typeof IMPORT_LINK_TYPES[keyof typeof IMPORT_LINK_TYPES];

/** Width of the sourceId and targetId columns: a ULID. Longer ids from a file get no link. */
export const IMPORT_LINK_ID_MAX = 26;
