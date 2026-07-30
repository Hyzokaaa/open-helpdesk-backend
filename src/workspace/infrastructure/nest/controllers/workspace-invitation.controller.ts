import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { JwtTokenService } from '../../../../shared/infrastructure/jwt-token-service';
import { EmailService } from '../../../../email/domain/email.service';
import { EMAIL_SERVICE } from '../../../../email/email.constants';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../domain/permissions';
import { CreateInvitation } from '../../../domain/services/invitation-create';
import { CancelInvitation } from '../../../domain/services/invitation-cancel';
import { CreateInvitationCommand } from '../../../application/commands/create-invitation.command';
import { CancelInvitationCommand } from '../../../application/commands/cancel-invitation.command';
import { ListInvitationsQuery } from '../../../application/queries/list-invitations.query';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceInvitationRepository } from '../../typeorm/repositories/typeorm-workspace-invitation.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { CreateInvitationRequest } from '../dto/create-invitation.request';
import { BatchInvitationRequest } from '../dto/batch-invitation.request';
import { BatchInvitationCommand } from '../../../application/commands/batch-invitation.command';
import { invitationEmail } from '../../../../email/templates/workspace-invitation.template';

@Controller('workspaces')
export class WorkspaceInvitationController {
  private readonly frontendUrl: string;

  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly invitationRepository: TypeOrmWorkspaceInvitationRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly tokenService: JwtTokenService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173').split(',')[0].trim();
  }

  @Post(':slug/invitations')
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateInvitationRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateInvitation(
      this.idGenerator,
      this.invitationRepository,
      this.memberRepository,
      this.userRepository,
      this.tokenService,
    );
    const command = new CreateInvitationCommand(service, ensurePermission);
    const result = await command.execute({
      workspaceId: workspace.getId(),
      email: body.email,
      role: body.role,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const inviter = await this.userRepository.findById(user.userId);
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : '';
    const invitationUrl = `${this.frontendUrl}/invite/${result.token}`;

    try {
      await this.emailService.send(invitationEmail({
        to: body.email,
        workspaceName: workspace.name,
        inviterName,
        invitationUrl,
        lang: 'en',
      }));
    } catch {
      // Email failure should not fail the invitation creation
    }

    return { id: result.id, email: result.email, role: result.role, status: result.status, expiresAt: result.expiresAt };
  }

  @Post(':slug/invitations/batch')
  async createBatch(
    @Param('slug') slug: string,
    @Body() body: BatchInvitationRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateInvitation(
      this.idGenerator,
      this.invitationRepository,
      this.memberRepository,
      this.userRepository,
      this.tokenService,
    );
    const command = new BatchInvitationCommand(service, ensurePermission);
    const results = await command.execute({
      workspaceId: workspace.getId(),
      invitations: body.invitations,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const inviter = await this.userRepository.findById(user.userId);
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : '';

    for (const result of results) {
      if (result.status === 'sent') {
        const invitation = await this.invitationRepository.findPendingByWorkspaceAndEmail(workspace.getId(), result.email);
        if (invitation) {
          const invitationUrl = `${this.frontendUrl}/invite/${invitation.token}`;
          try {
            await this.emailService.send(invitationEmail({
              to: result.email,
              workspaceName: workspace.name,
              inviterName,
              invitationUrl,
              lang: 'en',
            }));
          } catch {
            // Email failure should not fail the batch
          }
        }
      }
    }

    return results;
  }

  @Get(':slug/invitations')
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_INVITATIONS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const query = new ListInvitationsQuery(this.invitationRepository);
    return query.execute({ workspaceId: workspace.getId() });
  }

  @Delete(':slug/invitations/:id')
  async cancel(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CancelInvitation(this.invitationRepository);
    const command = new CancelInvitationCommand(service, ensurePermission);
    await command.execute({
      workspaceId: workspace.getId(),
      invitationId: id,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
    return { message: 'Invitation cancelled' };
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
