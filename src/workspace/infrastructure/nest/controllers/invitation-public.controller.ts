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
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';

@Controller('invitations')
export class InvitationPublicController {
  constructor(
    @Inject() private readonly invitationRepository: TypeOrmWorkspaceInvitationRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
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
    const invitation = await this.invitationRepository.findByToken(body.token);
    const service = new AcceptInvitation(this.idGenerator, this.invitationRepository, this.memberRepository);
    const command = new AcceptInvitationCommand(service);
    const result = await command.execute({ token: body.token, userId: user.userId, userEmail: user.email });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.INVITATION_ACCEPTED,
      entityType: 'invitation',
      entityId: invitation?.getId() ?? '',
      userId: user.userId,
      workspaceId: invitation?.workspaceId ?? null,
      metadata: { email: user.email, workspaceId: invitation?.workspaceId },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @SkipEmailVerification()
  @Post('reject')
  async reject(
    @Body() body: { token: string },
    @CurrentUser() user: AuthUser,
  ) {
    const invitation = await this.invitationRepository.findByToken(body.token);
    const service = new RejectInvitation(this.invitationRepository);
    const command = new RejectInvitationCommand(service);
    await command.execute({ token: body.token });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.INVITATION_REJECTED,
      entityType: 'invitation',
      entityId: invitation?.getId() ?? '',
      userId: user.userId,
      workspaceId: invitation?.workspaceId ?? null,
      metadata: { email: user.email, workspaceId: invitation?.workspaceId },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { message: 'Invitation rejected' };
  }
}
