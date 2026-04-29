import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { SkipEmailVerification } from '../../../../shared/nest/decorators/skip-email-verification.decorator';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { AcceptInvitation } from '../../../domain/services/invitation-accept';
import { RejectInvitation } from '../../../domain/services/invitation-reject';
import { AcceptInvitationCommand } from '../../../application/commands/accept-invitation.command';
import { RejectInvitationCommand } from '../../../application/commands/reject-invitation.command';
import { GetInvitationByTokenQuery } from '../../../application/queries/get-invitation-by-token.query';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceInvitationRepository } from '../../typeorm/repositories/typeorm-workspace-invitation.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';

@Controller('invitations')
export class InvitationPublicController {
  constructor(
    @Inject() private readonly invitationRepository: TypeOrmWorkspaceInvitationRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Public()
  @Get('by-token/:token')
  async getByToken(@Param('token') token: string) {
    const query = new GetInvitationByTokenQuery(this.invitationRepository, this.workspaceRepository, this.userRepository);
    return query.execute({ token });
  }

  @SkipEmailVerification()
  @Post('accept')
  async accept(
    @Body() body: { token: string },
    @CurrentUser() user: AuthUser,
  ) {
    const service = new AcceptInvitation(this.idGenerator, this.invitationRepository, this.memberRepository);
    const command = new AcceptInvitationCommand(service);
    return command.execute({ token: body.token, userId: user.userId, userEmail: user.email });
  }

  @SkipEmailVerification()
  @Post('reject')
  async reject(
    @Body() body: { token: string },
    @CurrentUser() user: AuthUser,
  ) {
    const service = new RejectInvitation(this.invitationRepository);
    const command = new RejectInvitationCommand(service);
    await command.execute({ token: body.token });
    return { message: 'Invitation rejected' };
  }
}
