import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { CreateWorkspace } from '../../../domain/services/workspace-create';
import { AddWorkspaceMember } from '../../../domain/services/workspace-add-member';
import { RemoveWorkspaceMember } from '../../../domain/services/workspace-remove-member';
import { EnsureWorkspacePermission } from '../../../domain/services/workspace-ensure-permission';
import { CreateWorkspaceCommand } from '../../../application/commands/create-workspace.command';
import { AddMemberCommand } from '../../../application/commands/add-member.command';
import { RemoveMemberCommand } from '../../../application/commands/remove-member.command';
import { ChangeWorkspaceMemberRole } from '../../../domain/services/workspace-change-member-role';
import { ChangeMemberRoleCommand } from '../../../application/commands/change-member-role.command';
import { UpdateWorkspace } from '../../../domain/services/workspace-update';
import { UpdateWorkspaceCommand } from '../../../application/commands/update-workspace.command';
import { UpdateWorkspacePalette } from '../../../domain/services/workspace-update-palette';
import { UpdateWorkspacePaletteCommand } from '../../../application/commands/update-workspace-palette.command';
import { UpdateWorkspaceSlaPolicy } from '../../../domain/services/workspace-update-sla-policy';
import { UpdateSlaPolicyCommand } from '../../../application/commands/update-sla-policy.command';
import { PERMISSIONS } from '../../../domain/permissions';
import { DeleteWorkspace } from '../../../domain/services/workspace-delete';
import { DeleteWorkspaceCommand } from '../../../application/commands/delete-workspace.command';
import { GetWorkspaceQuery } from '../../../application/queries/get-workspace.query';
import { ListWorkspacesQuery } from '../../../application/queries/list-workspaces.query';
import { ListWorkspaceMembersQuery } from '../../../application/queries/list-workspace-members.query';
import { GetMyPermissionsQuery } from '../../../application/queries/get-my-permissions.query';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmAccountRepository } from '../../../../account/infrastructure/typeorm/repositories/typeorm-account.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmMailboxRepository } from '../../../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CreateMailbox } from '../../../../mailbox/domain/services/mailbox-create';
import { CreateWorkspaceRequest } from '../dto/create-workspace.request';
import { AddMemberRequest } from '../dto/add-member.request';
import { SortDto } from '../../../../shared/nest/dto/sort.dto';
import { ConfigService } from '@nestjs/config';
import { ExportWorkspace } from '../../../domain/services/workspace-export';
import { ImportWorkspace } from '../../../domain/services/workspace-import';
import { createExportToken, validateExportToken } from '../../../domain/services/workspace-export-token';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { TypeOrmWorkspaceEmailSenderRepository } from '../../typeorm/repositories/typeorm-workspace-email-sender.repository';
import { WorkspaceEmailSender } from '../../../domain/entities/workspace-email-sender';
import * as nodemailer from 'nodemailer';

@Controller('workspaces')
export class WorkspaceController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly accountRepository: TypeOrmAccountRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly mailboxRepository: TypeOrmMailboxRepository,
    @Inject() private readonly config: ConfigService,
    @Inject() private readonly emailSenderRepository: TypeOrmWorkspaceEmailSenderRepository,
    private readonly dataSource: DataSource,
  ) {}

  @Post()
  async create(@Body() body: CreateWorkspaceRequest, @CurrentUser() user: AuthUser) {
    const account = await this.accountRepository.findByOwnerId(user.userId);
    const createService = new CreateWorkspace(this.idGenerator, this.workspaceRepository);
    const addMemberService = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const systemMailbox = await this.mailboxRepository.findSystemMailbox();
    const supportEmailDomain = systemMailbox
      ? systemMailbox.address.split('@')[1]
      : this.config.get<string>('SUPPORT_EMAIL_DOMAIN');
    const createMailbox = supportEmailDomain
      ? new CreateMailbox(this.idGenerator, this.mailboxRepository)
      : undefined;
    const command = new CreateWorkspaceCommand(createService, addMemberService, auditLog, createMailbox);
    return command.execute({
      name: body.name,
      description: body.description,
      creatorUserId: user.userId,
      accountId: account?.getId(),
      supportEmailDomain,
    });
  }

  @Get()
  list(@Query() sort: SortDto, @CurrentUser() user: AuthUser) {
    const query = new ListWorkspacesQuery(this.memberRepository, this.workspaceRepository, this.accountRepository, this.userRepository);
    return query.execute({ userId: user.userId, isSystemAdmin: user.isSystemAdmin, sort });
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    const query = new GetWorkspaceQuery(this.workspaceRepository, this.mailboxRepository);
    return query.execute({ slug });
  }

  @Patch(':slug')
  async update(
    @Param('slug') slug: string,
    @Body() body: { name?: string; description?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const service = new UpdateWorkspace(this.workspaceRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new UpdateWorkspaceCommand(service, auditLog);
    return command.execute({
      workspaceId,
      name: body.name,
      description: body.description,
      isSystemAdmin: user.isSystemAdmin,
      userId: user.userId,
    });
  }

  @Delete(':slug')
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const service = new DeleteWorkspace(this.workspaceRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new DeleteWorkspaceCommand(service, auditLog);
    return command.execute({ workspaceId, isSystemAdmin: user.isSystemAdmin, userId: user.userId });
  }

  @Post(':slug/members')
  async addMember(
    @Param('slug') slug: string,
    @Body() body: AddMemberRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const targetUser = await this.userRepository.findById(body.userId);
    const command = new AddMemberCommand(service, ensurePermission, auditLog);
    return command.execute({
      workspaceId,
      userId: body.userId,
      role: body.role,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      targetLabel: targetUser ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})` : body.userId,
    });
  }

  @Get(':slug/permissions')
  async myPermissions(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const query = new GetMyPermissionsQuery(this.memberRepository);
    return query.execute({ workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Get(':slug/members')
  async listMembers(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_VIEW,
      isSystemAdmin: user.isSystemAdmin,
    });
    const query = new ListWorkspaceMembersQuery(this.memberRepository, this.userRepository);
    return query.execute({ workspaceId });
  }

  @Patch(':slug/members/:userId/role')
  async changeMemberRole(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const targetUser = await this.userRepository.findById(userId);
    const service = new ChangeWorkspaceMemberRole(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new ChangeMemberRoleCommand(service, auditLog);
    return command.execute({
      workspaceId,
      targetUserId: userId,
      newRole: body.role as any,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      targetLabel: targetUser ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})` : userId,
    });
  }

  @Delete(':slug/members/:userId')
  async removeMember(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new RemoveWorkspaceMember(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const targetUser = await this.userRepository.findById(userId);
    const command = new RemoveMemberCommand(service, ensurePermission, auditLog);
    return command.execute({ workspaceId, userId, requestingUserId: user.userId, isSystemAdmin: user.isSystemAdmin, targetLabel: targetUser ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})` : userId });
  }

  @Patch(':slug/palette')
  async updatePalette(
    @Param('slug') slug: string,
    @Body() body: { palette: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const service = new UpdateWorkspacePalette(this.workspaceRepository);
    const command = new UpdateWorkspacePaletteCommand(service);
    const result = await command.execute({ workspaceId, palette: body.palette });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.WORKSPACE_PALETTE_UPDATED,
      entityType: 'workspace',
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { palette: body.palette },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Get(':slug/sla')
  async getSla(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const workspace = await this.workspaceRepository.findById(workspaceId);
    return { slaPolicy: workspace?.slaPolicy ?? null };
  }

  @Patch(':slug/sla')
  async updateSla(
    @Param('slug') slug: string,
    @Body() body: { slaPolicy: any },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const service = new UpdateWorkspaceSlaPolicy(this.workspaceRepository);
    const command = new UpdateSlaPolicyCommand(service);
    const result = await command.execute({ workspaceId, slaPolicy: body.slaPolicy });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.WORKSPACE_SLA_UPDATED,
      entityType: 'workspace',
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { slaPolicy: body.slaPolicy },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Patch(':slug/system-mailbox')
  async toggleSystemMailbox(
    @Param('slug') slug: string,
    @Body() body: { enabled: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    workspace.systemMailboxEnabled = body.enabled;
    await this.workspaceRepository.update(workspace);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.WORKSPACE_SYSTEM_MAILBOX_TOGGLED,
      entityType: 'workspace',
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { systemMailboxEnabled: body.enabled },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { systemMailboxEnabled: workspace.systemMailboxEnabled };
  }

  @Get(':slug/export')
  async exportWorkspace(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const service = new ExportWorkspace(this.dataSource);
    const data = await service.execute(workspaceId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-export.json"`);
    res.send(JSON.stringify(data, null, 2));
  }

  @Post(':slug/import')
  async importWorkspace(
    @Param('slug') slug: string,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    // Support URL-based import: { url: "https://..." }
    let data = body;
    if (body.url && typeof body.url === 'string') {
      const response = await fetch(body.url);
      if (!response.ok) throw new Error(`Failed to fetch export from URL: ${response.status}`);
      data = await response.json();
    }

    const service = new ImportWorkspace(this.dataSource);
    const result = await service.execute(workspaceId, data);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.WORKSPACE_IMPORT_STARTED,
      entityType: 'workspace',
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { source: body.url ? 'url' : 'direct', imported: result },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Post(':slug/export/token')
  async createExportTokenEndpoint(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const { token, expiresAt } = createExportToken(workspaceId);
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || '';

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.WORKSPACE_EXPORT_CREATED,
      entityType: 'workspace',
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: {},
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return {
      url: `${baseUrl}/workspaces/${slug}/export/${token}`,
      expiresAt,
    };
  }

  @Public()
  @Get(':slug/export/:token')
  async exportByToken(
    @Param('slug') slug: string,
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const workspaceId = validateExportToken(token);
    if (!workspaceId) {
      res.status(401).json({ message: 'Invalid or expired export token' });
      return;
    }
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace || workspace.getId() !== workspaceId) {
      res.status(404).json({ message: 'Workspace not found' });
      return;
    }
    const service = new ExportWorkspace(this.dataSource);
    const data = await service.execute(workspaceId);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data));
  }

  @Get(':slug/email-sender')
  async getEmailSender(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId, userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const sender = await this.emailSenderRepository.findByWorkspaceId(workspaceId);
    if (!sender) return null;
    return {
      id: sender.getId(),
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      smtpUser: sender.smtpUser,
      hasPassword: true,
      smtpFrom: sender.smtpFrom,
      encryption: sender.encryption,
    };
  }

  @Post(':slug/email-sender')
  async createEmailSender(
    @Param('slug') slug: string,
    @Body() body: { smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; smtpFrom: string; encryption?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId, userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    let resultId: string;
    const existing = await this.emailSenderRepository.findByWorkspaceId(workspaceId);
    if (existing) {
      existing.smtpHost = body.smtpHost;
      existing.smtpPort = body.smtpPort;
      existing.smtpUser = body.smtpUser;
      if (body.smtpPass) existing.smtpPass = body.smtpPass;
      existing.smtpFrom = body.smtpFrom;
      if (body.encryption) existing.encryption = body.encryption;
      await this.emailSenderRepository.update(existing);
      resultId = existing.getId();
    } else {
      const sender = new WorkspaceEmailSender({
        id: this.idGenerator.create(),
        workspaceId,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpUser: body.smtpUser,
        smtpPass: body.smtpPass,
        smtpFrom: body.smtpFrom,
        encryption: body.encryption,
      });
      await this.emailSenderRepository.create(sender);
      resultId = sender.getId();
    }

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.EMAIL_SENDER_CONFIGURED,
      entityType: 'email-sender',
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { smtpHost: body.smtpHost, smtpFrom: body.smtpFrom },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { id: resultId };
  }

  @Delete(':slug/email-sender')
  async deleteEmailSender(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId, userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const existing = await this.emailSenderRepository.findByWorkspaceId(workspaceId);
    await this.emailSenderRepository.delete(workspaceId);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.EMAIL_SENDER_DELETED,
      entityType: 'email-sender',
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { smtpHost: existing?.smtpHost, smtpFrom: existing?.smtpFrom },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
  }

  @Post(':slug/email-sender/test')
  async testEmailSender(
    @Param('slug') slug: string,
    @Body() body: { smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; encryption?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);

    try {
      const encryption = body.encryption ?? 'tls';
      const tls = encryption === 'tls-insecure' ? { rejectUnauthorized: false } :
                  encryption === 'none' ? { rejectUnauthorized: false } : { rejectUnauthorized: true };
      const transporter = nodemailer.createTransport({
        host: body.smtpHost,
        port: body.smtpPort,
        secure: body.smtpPort === 465,
        auth: { user: body.smtpUser, pass: body.smtpPass },
        tls,
        ...((encryption === 'none') && { ignoreTLS: true }),
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      } as any);
      await transporter.verify();

      await auditLog.execute({
        action: AuditAction.EMAIL_SENDER_TEST_CONNECTION,
        entityType: 'email-sender',
        entityId: workspaceId,
        userId: user.userId,
        workspaceId,
        metadata: { success: true, smtpHost: body.smtpHost },
        category: AuditCategory.CONFIG,
        level: AuditLevel.INFO,
        source: 'ui',
      });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';

      await auditLog.execute({
        action: AuditAction.EMAIL_SENDER_TEST_CONNECTION,
        entityType: 'email-sender',
        entityId: workspaceId,
        userId: user.userId,
        workspaceId,
        metadata: { success: false, error: msg, smtpHost: body.smtpHost },
        category: AuditCategory.CONFIG,
        level: AuditLevel.WARNING,
        source: 'ui',
      });

      return { success: false, error: msg };
    }
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
