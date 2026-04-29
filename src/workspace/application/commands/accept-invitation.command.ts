import { Command } from '../../../shared/domain/command';
import { AcceptInvitation } from '../../domain/services/invitation-accept';

interface Props {
  token: string;
  userId: string;
  userEmail: string;
}

export interface AcceptInvitationResponse {
  workspaceId: string;
  role: string;
}

export class AcceptInvitationCommand implements Command<Props, AcceptInvitationResponse> {
  constructor(private readonly acceptInvitation: AcceptInvitation) {}

  async execute(props: Props): Promise<AcceptInvitationResponse> {
    return this.acceptInvitation.execute(props);
  }
}
