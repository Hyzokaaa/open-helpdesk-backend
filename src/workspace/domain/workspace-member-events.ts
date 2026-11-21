import { WorkspaceRole } from './enums/workspace-role.enum';

/** Published as 'workspace.member.removed' once someone is no longer in the workspace. */
export interface WorkspaceMemberRemovedEvent {
  workspaceId: string;
  userId: string;
}

/** Published as 'workspace.members.joined' when people come into a workspace: by invitation, added or imported. */
export interface WorkspaceMembersJoinedEvent {
  workspaceId: string;
  members: Array<{ userId: string; role: WorkspaceRole }>;
  /** Who brought them in, when someone added or imported them; none when they accepted an invitation. */
  actorId: string | null;
}

export const WORKSPACE_MEMBERS_JOINED_EVENT = 'workspace.members.joined';
