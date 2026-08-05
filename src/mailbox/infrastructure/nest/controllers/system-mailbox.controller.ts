import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Inject,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmMailboxRepository } from '../../typeorm/repositories/typeorm-mailbox.repository';
import { CreateImapMailbox } from '../../../domain/services/mailbox-create-imap';
import { UpdateMailbox } from '../../../domain/services/mailbox-update';
import { DeleteMailbox } from '../../../domain/services/mailbox-delete';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { EntityNotFoundError } from '../../../../shared/domain/errors';

@Controller('admin/platform-mailbox')
export class SystemMailboxController {
  constructor(
    @Inject() private readonly mailboxRepository: TypeOrmMailboxRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);

    const mailbox = await this.mailboxRepository.findSystemMailbox();
    if (!mailbox) return null;

    return {
      id: mailbox.getId(),
      address: mailbox.address,
      type: mailbox.type,
      isActive: mailbox.isActive,
      imapHost: mailbox.imapHost,
      imapPort: mailbox.imapPort,
      imapUser: mailbox.imapUser,
      hasPassword: !!mailbox.imapPass,
      imapTls: mailbox.imapTls,
      encryption: mailbox.encryption,
      imapFolder: mailbox.imapFolder,
      pollInterval: mailbox.pollInterval,
      lastSyncAt: mailbox.lastSyncAt,
      lastSyncDuration: mailbox.lastSyncDuration,
      lastError: mailbox.lastError,
      addressMode: mailbox.addressMode,
      acceptedAddresses: mailbox.acceptedAddresses,
      autoReply: mailbox.autoReply,
    };
  }

  @Post()
  async create(
    @Body() body: {
      address: string;
      imapHost: string;
      imapPort: number;
      imapUser: string;
      imapPass: string;
      imapTls?: boolean;
      encryption?: string;
      imapFolder?: string;
      pollInterval?: number;
      autoReply?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    this.ensureAdmin(user);

    const existing = await this.mailboxRepository.findSystemMailbox();
    if (existing) {
      throw new BadRequestException('A system mailbox already exists');
    }

    const service = new CreateImapMailbox(this.idGenerator, this.mailboxRepository);
    const mailbox = await service.execute({
      workspaceId: null,
      address: body.address,
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      imapUser: body.imapUser,
      imapPass: body.imapPass,
      imapTls: body.imapTls,
      encryption: body.encryption,
      imapFolder: body.imapFolder,
      pollInterval: body.pollInterval,
      addressMode: 'all',
      autoReply: body.autoReply,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.SYSTEM_MAILBOX_CONFIGURED,
      entityType: 'mailbox',
      entityId: mailbox.getId(),
      userId: user.userId,
      workspaceId: null,
      metadata: {
        address: mailbox.address,
        imapHost: mailbox.imapHost,
        imapFolder: mailbox.imapFolder,
        pollInterval: mailbox.pollInterval,
      },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return {
      id: mailbox.getId(),
      address: mailbox.address,
      type: mailbox.type,
      isActive: mailbox.isActive,
    };
  }

  @Patch()
  async update(
    @Body() body: {
      address?: string;
      isActive?: boolean;
      imapHost?: string | null;
      imapPort?: number | null;
      imapUser?: string | null;
      imapPass?: string | null;
      imapTls?: boolean | null;
      encryption?: string;
      imapFolder?: string | null;
      pollInterval?: number | null;
      autoReply?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    this.ensureAdmin(user);

    const existing = await this.mailboxRepository.findSystemMailbox();
    if (!existing) {
      throw new EntityNotFoundError('System mailbox not found');
    }

    const service = new UpdateMailbox(this.mailboxRepository);
    const mailbox = await service.execute({ id: existing.getId(), ...body });

    return {
      id: mailbox.getId(),
      address: mailbox.address,
      type: mailbox.type,
      isActive: mailbox.isActive,
      imapHost: mailbox.imapHost,
      imapPort: mailbox.imapPort,
      imapUser: mailbox.imapUser,
      hasPassword: !!mailbox.imapPass,
      imapTls: mailbox.imapTls,
      encryption: mailbox.encryption,
      imapFolder: mailbox.imapFolder,
      pollInterval: mailbox.pollInterval,
      lastSyncAt: mailbox.lastSyncAt,
      lastSyncDuration: mailbox.lastSyncDuration,
      lastError: mailbox.lastError,
      addressMode: mailbox.addressMode,
      acceptedAddresses: mailbox.acceptedAddresses,
      autoReply: mailbox.autoReply,
    };
  }

  @Delete()
  async remove(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);

    const existing = await this.mailboxRepository.findSystemMailbox();
    if (!existing) {
      throw new EntityNotFoundError('System mailbox not found');
    }

    const service = new DeleteMailbox(this.mailboxRepository);
    await service.execute(existing.getId());

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.SYSTEM_MAILBOX_DELETED,
      entityType: 'mailbox',
      entityId: existing.getId(),
      userId: user.userId,
      workspaceId: null,
      metadata: { address: existing.address },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });
  }

  @Post('test-connection')
  async testConnection(
    @Body() body: {
      imapHost: string;
      imapPort: number;
      imapUser: string;
      imapPass: string;
      imapTls?: boolean;
      encryption?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    this.ensureAdmin(user);

    // If password is empty or __keep__, use the stored password
    let password = body.imapPass;
    if (!password || password === '__keep__') {
      const existing = await this.mailboxRepository.findSystemMailbox();
      if (existing && existing.imapPass) {
        password = existing.imapPass;
      }
    }

    if (!password) {
      return { success: false, error: 'Password is required', folders: [] };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ImapFlow } = require('imapflow');

      const encryption = body.encryption ?? (body.imapTls === false ? 'none' : 'tls');
      const secure = encryption === 'tls' || encryption === 'tls-insecure';
      const tlsOptions = encryption === 'tls-insecure' ? { rejectUnauthorized: false } : undefined;

      const client = new ImapFlow({
        host: body.imapHost,
        port: body.imapPort,
        secure,
        ...(tlsOptions && { tls: tlsOptions }),
        auth: { user: body.imapUser, pass: password },
        logger: false,
      });

      client.on('error', () => {});

      await client.connect();

      const folders: string[] = [];
      const mailboxes = await client.list();
      for (const mb of mailboxes) {
        folders.push(mb.path);
      }

      try { await client.logout(); } catch { /* ignore */ }

      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.SYSTEM_MAILBOX_TEST_CONNECTION,
        entityType: 'mailbox',
        entityId: 'system',
        userId: user.userId,
        workspaceId: null,
        metadata: { host: body.imapHost, port: body.imapPort, success: true },
        category: AuditCategory.SYSTEM,
        level: AuditLevel.INFO,
        source: 'ui',
      });

      return { success: true, folders };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';

      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.SYSTEM_MAILBOX_TEST_CONNECTION,
        entityType: 'mailbox',
        entityId: 'system',
        userId: user.userId,
        workspaceId: null,
        metadata: { host: body.imapHost, port: body.imapPort, success: false, error: msg },
        category: AuditCategory.SYSTEM,
        level: AuditLevel.WARNING,
        source: 'ui',
      });

      return { success: false, error: msg, folders: [] };
    }
  }

  @Post('pause')
  async pause(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    const existing = await this.mailboxRepository.findSystemMailbox();
    if (!existing) throw new EntityNotFoundError('System mailbox not found');

    existing.isActive = false;
    await this.mailboxRepository.update(existing);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.MAILBOX_PAUSED,
      entityType: 'mailbox',
      entityId: existing.getId(),
      userId: user.userId,
      workspaceId: null,
      metadata: { address: existing.address },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { isActive: false };
  }

  @Post('resume')
  async resume(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    const existing = await this.mailboxRepository.findSystemMailbox();
    if (!existing) throw new EntityNotFoundError('System mailbox not found');

    existing.isActive = true;
    await this.mailboxRepository.update(existing);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.MAILBOX_RESUMED,
      entityType: 'mailbox',
      entityId: existing.getId(),
      userId: user.userId,
      workspaceId: null,
      metadata: { address: existing.address },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { isActive: true };
  }

  private ensureAdmin(user: AuthUser): void {
    if (!user.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
  }
}
