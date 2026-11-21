import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { WORKSPACE_MEMBERS_JOINED_EVENT, WorkspaceMembersJoinedEvent } from '../../../../workspace/domain/workspace-member-events';
import { SendMembersJoinedNotice } from '../../../domain/services/notice-members-joined-send';
import { NoticeService } from './notice.service';

/** "New team member": the workspace's admins hear who joined. A failure is logged and never reaches the join. */
@Injectable()
export class MembersJoinedNoticeListener {
  private readonly logger = new Logger(MembersJoinedNoticeListener.name);

  constructor(
    @Inject() private readonly notices: NoticeService,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
  ) {}

  @OnEvent(WORKSPACE_MEMBERS_JOINED_EVENT)
  async onMembersJoined(event: WorkspaceMembersJoinedEvent): Promise<void> {
    try {
      await new SendMembersJoinedNotice(this.notices, this.workspaceRepository, this.userRepository).execute(event);
    } catch (error) {
      this.logger.warn(`New member notice for workspace ${event.workspaceId} failed: ${(error as Error).message}`);
    }
  }
}
