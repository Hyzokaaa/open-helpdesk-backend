import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
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
import { ResendInvitation } from '../../../domain/services/invitation-resend';
import { CreateInvitationCommand } from '../../../application/commands/create-invitation.command';
import { CancelInvitationCommand } from '../../../application/commands/cancel-invitation.command';
import { ListInvitationsQuery } from '../../../application/queries/list-invitations.query';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmWorkspaceInvitationRepository } from '../../typeorm/repositories/typeorm-workspace-invitation.repository';
import { TypeOrmWorkspaceEmailSenderRepository } from '../../typeorm/repositories/typeorm-workspace-email-sender.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CreateInvitationRequest } from '../dto/create-invitation.request';
import { BatchInvitationRequest } from '../dto/batch-invitation.request';
import { BatchInvitationCommand } from '../../../application/commands/batch-invitation.command';
import { invitationEmail } from '../../../../email/templates/workspace-invitation.template';
import { sendWorkspaceEmail } from '../../../../email/domain/resolve-email-sender';
import { resolveFrontendUrl } from '../../../../shared/infrastructure/resolve-frontend-url';

@Controller('workspaces')
export class WorkspaceInvitationController {
  private readonly frontendUrl: string;
  private readonly allowedFrontendUrls: string[];

  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly invitationRepository: TypeOrmWorkspaceInvitationRepository,
    @Inject() private readonly emailSenderRepository: TypeOrmWorkspaceEmailSenderRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly tokenService: JwtTokenService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
    const corsOrigins = config.get('CORS_ORIGINS', this.frontendUrl);
    this.allowedFrontendUrls = corsOrigins.split(',').map((u: string) => u.trim());
  }

  @Post(':slug/invitations')
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateInvitationRequest,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const frontendUrl = resolveFrontendUrl(req, this.allowedFrontendUrls, this.frontendUrl);
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
    const invitationUrl = `${frontendUrl}/invite/${result.token}`;

    const sender = await this.emailSenderRepository.findByWorkspaceId(workspace.getId());
    try {
      await sendWorkspaceEmail(this.emailService, sender, invitationEmail({
        to: body.email,
        workspaceName: workspace.name,
        inviterName,
        invitationUrl,
        lang: 'en',
      }));
    } catch {
      // Email failure should not fail the invitation creation
    }

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.INVITATION_CREATED,
      entityType: 'invitation',
      entityId: result.id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { email: body.email, role: body.role },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { id: result.id, email: result.email, role: result.role, status: result.status, expiresAt: result.expiresAt };
  }

  @Post(':slug/invitations/batch')
  async createBatch(
    @Param('slug') slug: string,
    @Body() body: BatchInvitationRequest,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const frontendUrl = resolveFrontendUrl(req, this.allowedFrontendUrls, this.frontendUrl);
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
    const sender = await this.emailSenderRepository.findByWorkspaceId(workspace.getId());

    for (const result of results) {
      if (result.status === 'sent') {
        const invitation = await this.invitationRepository.findPendingByWorkspaceAndEmail(workspace.getId(), result.email);
        if (invitation) {
          const invitationUrl = `${frontendUrl}/invite/${invitation.token}`;
          try {
            const emailResult = await sendWorkspaceEmail(this.emailService, sender, invitationEmail({
              to: result.email,
              workspaceName: workspace.name,
              inviterName,
              invitationUrl,
              lang: 'en',
            }));
            (result as any).emailSent = emailResult.success && !emailResult.mock;
          } catch {
            (result as any).emailSent = false;
          }
        }
      }
    }

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.INVITATION_BATCH_CREATED,
      entityType: 'invitation',
      entityId: workspace.getId(),
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { count: body.invitations.length },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

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

  @Get(':slug/invitations/:id/link')
  async getLink(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_INVITATIONS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const invitation = await this.invitationRepository.findById(id);
    if (!invitation || invitation.workspaceId !== workspace.getId()) {
      throw new EntityNotFoundError('Invitation not found');
    }
    const frontendUrl = resolveFrontendUrl(req, this.allowedFrontendUrls, this.frontendUrl);
    return { link: `${frontendUrl}/invite/${invitation.token}` };
  }

  @Post(':slug/invitations/:id/resend')
  async resend(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const frontendUrl = resolveFrontendUrl(req, this.allowedFrontendUrls, this.frontendUrl);
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_INVITATIONS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const service = new ResendInvitation(this.invitationRepository);
    const invitation = await service.execute({ invitationId: id });

    const inviter = await this.userRepository.findById(user.userId);
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : '';
    const invitationUrl = `${frontendUrl}/invite/${invitation.token}`;

    const sender = await this.emailSenderRepository.findByWorkspaceId(workspace.getId());
    let emailSent = false;
    try {
      const emailResult = await sendWorkspaceEmail(this.emailService, sender, invitationEmail({
        to: invitation.email,
        workspaceName: workspace.name,
        inviterName,
        invitationUrl,
        lang: 'en',
      }));
      emailSent = emailResult.success && !emailResult.mock;
    } catch {
      // Email failure should not fail the resend
    }

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.INVITATION_RESENT,
      entityType: 'invitation',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { email: invitation.email, emailSent },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { id: invitation.getId(), email: invitation.email, expiresAt: invitation.expiresAt, emailSent };
  }

  @Delete(':slug/invitations/:id')
  async cancel(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const invitation = await this.invitationRepository.findById(id);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CancelInvitation(this.invitationRepository);
    const command = new CancelInvitationCommand(service, ensurePermission);
    await command.execute({
      workspaceId: workspace.getId(),
      invitationId: id,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.INVITATION_CANCELLED,
      entityType: 'invitation',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { email: invitation?.email },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { message: 'Invitation cancelled' };
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
