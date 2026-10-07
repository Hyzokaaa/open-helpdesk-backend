/**
 * The storage keys of the files that belong to a workspace (attachments, organization logos),
 * gathered before it is purged: its rows go with the database cascade, its files do not.
 */
export interface WorkspaceFileKeys {
  listFor(workspaceId: string): Promise<string[]>;
}
