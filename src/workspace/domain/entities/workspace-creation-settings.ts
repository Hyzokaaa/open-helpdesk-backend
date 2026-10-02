interface Props {
  id: string;
  selfService: boolean;
}

/** Installation-wide settings on who may create workspaces. A single row. */
export class WorkspaceCreationSettings {
  id: string;
  /** Whether any signed-in user may create a workspace, not only system admins. */
  selfService: boolean;

  constructor(props: Props) {
    this.id = props.id;
    this.selfService = props.selfService ?? false;
  }
}
