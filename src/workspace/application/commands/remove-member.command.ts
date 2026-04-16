import { Command } from '../../../shared/domain/command';
import { RemoveWorkspaceMember } from '../../domain/services/workspace-remove-member';

interface Props {
  workspaceId: string;
  userId: string;
}

export class RemoveMemberCommand implements Command<Props, void> {
  constructor(private readonly removeMember: RemoveWorkspaceMember) {}

  async execute(props: Props): Promise<void> {
    await this.removeMember.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
    });
  }
}
