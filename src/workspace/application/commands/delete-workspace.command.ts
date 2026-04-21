import { Command } from '../../../shared/domain/command';
import { DeleteWorkspace } from '../../domain/services/workspace-delete';

interface Props {
  workspaceId: string;
  isSystemAdmin: boolean;
}

export class DeleteWorkspaceCommand implements Command<Props, void> {
  constructor(private readonly deleteWorkspace: DeleteWorkspace) {}

  async execute(props: Props): Promise<void> {
    await this.deleteWorkspace.execute(props);
  }
}
