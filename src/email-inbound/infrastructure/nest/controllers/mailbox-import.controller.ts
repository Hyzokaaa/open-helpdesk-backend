import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { UpdateMailbox } from '../../../../mailbox/domain/services/mailbox-update';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmMailboxRepository } from '../../../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { ImapPollingService } from '../../imap/imap-polling.service';

@Controller('workspaces/:slug/mailboxes')
export class MailboxImportController {
  constructor(
    @Inject() private readonly mailboxRepository: TypeOrmMailboxRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly imapPollingService: ImapPollingService,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Post(':mailboxId/import')
  async importEmails(
    @Param('slug') slug: string,
    @Param('mailboxId') mailboxId: string,
    @Body() body: { since?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const mailbox = await this.resolveMailbox(slug, mailboxId, user);
    const since = body.since ? new Date(body.since) : null;
    const result = await this.imapPollingService.importMailbox(mailbox.getId(), since);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.MAILBOX_IMPORT_STARTED,
      entityType: 'mailbox',
      entityId: mailboxId,
      userId: user.userId,
      workspaceId: mailbox.workspaceId,
      metadata: { address: mailbox.address },
      category: AuditCategory.EMAIL,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Post(':mailboxId/poll-now')
  async pollNow(
    @Param('slug') slug: string,
    @Param('mailboxId') mailboxId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const mailbox = await this.resolveMailbox(slug, mailboxId, user);
    const since = mailbox.lastSyncAt ?? null;
    const result = await this.imapPollingService.importMailbox(mailbox.getId(), since);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.MAILBOX_POLL_TRIGGERED,
      entityType: 'mailbox',
      entityId: mailboxId,
      userId: user.userId,
      workspaceId: mailbox.workspaceId,
      metadata: { address: mailbox.address },
      category: AuditCategory.EMAIL,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Post(':mailboxId/pause')
  async pause(
    @Param('slug') slug: string,
    @Param('mailboxId') mailboxId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const mailbox = await this.resolveMailbox(slug, mailboxId, user);
    const service = new UpdateMailbox(this.mailboxRepository);
    await service.execute({ id: mailbox.getId(), isActive: false });
    await this.imapPollingService.refreshNow();

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.MAILBOX_PAUSED,
      entityType: 'mailbox',
      entityId: mailboxId,
      userId: user.userId,
      workspaceId: mailbox.workspaceId,
      metadata: { address: mailbox.address },
      category: AuditCategory.EMAIL,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { isActive: false };
  }

  @Post(':mailboxId/resume')
  async resume(
    @Param('slug') slug: string,
    @Param('mailboxId') mailboxId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const mailbox = await this.resolveMailbox(slug, mailboxId, user);
    const service = new UpdateMailbox(this.mailboxRepository);
    await service.execute({ id: mailbox.getId(), isActive: true });
    await this.imapPollingService.refreshNow();

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.MAILBOX_RESUMED,
      entityType: 'mailbox',
      entityId: mailboxId,
      userId: user.userId,
      workspaceId: mailbox.workspaceId,
      metadata: { address: mailbox.address },
      category: AuditCategory.EMAIL,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { isActive: true };
  }

  private async resolveMailbox(slug: string, mailboxId: string, user: AuthUser) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const mailbox = await this.mailboxRepository.findById(mailboxId);
    if (!mailbox || mailbox.workspaceId !== workspace.getId()) {
      throw new EntityNotFoundError('Mailbox not found');
    }
    return mailbox;
  }
}
