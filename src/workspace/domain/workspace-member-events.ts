/** Published as 'workspace.member.removed' once someone is no longer in the workspace. */
export interface WorkspaceMemberRemovedEvent {
  workspaceId: string;
  userId: string;
}
