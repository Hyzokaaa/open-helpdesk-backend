import { Command } from '../../../shared/domain/command';
import { RejectInvitation } from '../../domain/services/invitation-reject';

interface Props {
  token: string;
}

export class RejectInvitationCommand implements Command<Props, void> {
  constructor(private readonly rejectInvitation: RejectInvitation) {}

  async execute(props: Props): Promise<void> {
    return this.rejectInvitation.execute(props);
  }
}
