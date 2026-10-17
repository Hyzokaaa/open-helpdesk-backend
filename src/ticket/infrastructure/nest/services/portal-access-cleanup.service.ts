import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkspaceMemberRemovedEvent } from '../../../../workspace/domain/workspace-member-events';
import { TypeOrmTicketPortalAccessRepository } from '../../typeorm/repositories/typeorm-ticket-portal-access.repository';

/** Someone who leaves a workspace keeps no portal link to its tickets. */
@Injectable()
export class PortalAccessCleanupService {
  constructor(private readonly portalAccessRepository: TypeOrmTicketPortalAccessRepository) {}

  @OnEvent('workspace.member.removed')
  async onMemberRemoved(event: WorkspaceMemberRemovedEvent): Promise<void> {
    await this.portalAccessRepository.removeByUserInWorkspace(event.userId, event.workspaceId);
  }
}
