import { Id } from '../../../shared/domain/id';
import { WorkspaceRole } from '../enums/workspace-role.enum';

interface Props {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export class WorkspaceMember {
  readonly id: Id;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.userId = props.userId;
    this.role = props.role;
  }

  getId(): string {
    return this.id.get();
  }
}
