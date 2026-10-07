interface Props {
  workspaceId: string;
  style?: string;
  prefix?: string;
  secret?: string | null;
}

/**
 * How a workspace shows its ticket references. Kept apart from the workspace so the key of the
 * random references is read only by what formats them, never by everything that loads a workspace.
 */
export class WorkspaceTicketReference {
  workspaceId: string;
  style: string;
  prefix: string;
  /** Generated the first time random references are turned on, and never changed after. */
  secret: string | null;

  constructor(props: Props) {
    this.workspaceId = props.workspaceId;
    this.style = props.style ?? 'sequential';
    this.prefix = props.prefix ?? 'TK';
    this.secret = props.secret ?? null;
  }
}
