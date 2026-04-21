import { WorkspaceRole } from './enums/workspace-role.enum';

export const PERMISSIONS = {
  // Workspace
  WORKSPACE_CREATE: 'workspace.create',
  WORKSPACE_MEMBERS_MANAGE: 'workspace.members.manage',

  // Tags
  TAG_CREATE: 'tag.create',
  TAG_DELETE: 'tag.delete',
  TAG_VIEW: 'tag.view',

  // Tickets
  TICKET_CREATE: 'ticket.create',
  TICKET_VIEW: 'ticket.view',
  TICKET_EDIT_NAME: 'ticket.edit.name',
  TICKET_EDIT_DESCRIPTION: 'ticket.edit.description',
  TICKET_EDIT_PRIORITY: 'ticket.edit.priority',
  TICKET_EDIT_CATEGORY: 'ticket.edit.category',
  TICKET_EDIT_TAGS: 'ticket.edit.tags',
  TICKET_CHANGE_STATUS: 'ticket.change.status',
  TICKET_CHANGE_STATUS_CLOSED: 'ticket.change.status.closed',
  TICKET_ASSIGN: 'ticket.assign',
  TICKET_DELETE: 'ticket.delete',
  TICKET_EDIT_CLOSED: 'ticket.edit.closed',

  // Comments
  COMMENT_CREATE: 'comment.create',

  // Attachments
  ATTACHMENT_UPLOAD: 'attachment.upload',
  ATTACHMENT_DELETE: 'attachment.delete',

  // Users
  USER_CREATE: 'user.create',
  USER_LIST: 'user.list',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ADMIN_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const AGENT_PERMISSIONS: Permission[] = [
  PERMISSIONS.TAG_CREATE,
  PERMISSIONS.TAG_VIEW,
  PERMISSIONS.TICKET_CREATE,
  PERMISSIONS.TICKET_VIEW,
  PERMISSIONS.TICKET_EDIT_DESCRIPTION,
  PERMISSIONS.TICKET_EDIT_PRIORITY,
  PERMISSIONS.TICKET_EDIT_CATEGORY,
  PERMISSIONS.TICKET_EDIT_TAGS,
  PERMISSIONS.TICKET_CHANGE_STATUS,
  PERMISSIONS.TICKET_DELETE,
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.ATTACHMENT_UPLOAD,
  PERMISSIONS.ATTACHMENT_DELETE,
  PERMISSIONS.USER_LIST,
];

const REPORTER_PERMISSIONS: Permission[] = [
  PERMISSIONS.TAG_VIEW,
  PERMISSIONS.TICKET_CREATE,
  PERMISSIONS.TICKET_VIEW,
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.ATTACHMENT_UPLOAD,
  PERMISSIONS.ATTACHMENT_DELETE,
  PERMISSIONS.USER_LIST,
];

const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  [WorkspaceRole.ADMIN]: ADMIN_PERMISSIONS,
  [WorkspaceRole.AGENT]: AGENT_PERMISSIONS,
  [WorkspaceRole.REPORTER]: REPORTER_PERMISSIONS,
};

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(role: WorkspaceRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}
