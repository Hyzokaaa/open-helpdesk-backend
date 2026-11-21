import { Command } from '../../../shared/domain/command';
import { AcceptInvitation } from '../../domain/services/invitation-accept';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { WORKSPACE_MEMBERS_JOINED_EVENT, WorkspaceMembersJoinedEvent } from '../../../workspace/domain/workspace-member-events';

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
  constructor(
    private readonly acceptInvitation: AcceptInvitation,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(props: Props): Promise<AcceptInvitationResponse> {
    const { workspaceId, role, joined } = await this.acceptInvitation.execute(props);
    if (joined) {
      const event: WorkspaceMembersJoinedEvent = { workspaceId, members: [{ userId: props.userId, role }], actorId: null };
      this.eventPublisher.emit(WORKSPACE_MEMBERS_JOINED_EVENT, event);
    }
    return { workspaceId, role };
  }
}
