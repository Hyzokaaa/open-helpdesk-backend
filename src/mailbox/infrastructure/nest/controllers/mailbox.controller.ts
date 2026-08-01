import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmMailboxRepository } from '../../typeorm/repositories/typeorm-mailbox.repository';
import { CreateImapMailbox } from '../../../domain/services/mailbox-create-imap';
import { UpdateMailbox } from '../../../domain/services/mailbox-update';
import { DeleteMailbox } from '../../../domain/services/mailbox-delete';
import { MailboxType } from '../../../domain/enums/mailbox-type.enum';

@Controller('workspaces/:slug/mailboxes')
export class MailboxController {
  constructor(
    @Inject() private readonly mailboxRepository: TypeOrmMailboxRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Get()
  async list(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user);

    const mailboxes = await this.mailboxRepository.findAllByWorkspaceId(workspaceId);
    return mailboxes.map((m) => ({
      id: m.getId(),
      address: m.address,
      type: m.type,
      isActive: m.isActive,
      imapHost: m.imapHost,
      imapPort: m.imapPort,
      imapUser: m.imapUser,
      hasPassword: !!m.imapPass,
      imapTls: m.imapTls,
      imapFolder: m.imapFolder,
      pollInterval: m.pollInterval,
      lastSyncAt: m.lastSyncAt,
      lastSyncDuration: m.lastSyncDuration,
      lastError: m.lastError,
    }));
  }

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: {
      address: string;
      imapHost: string;
      imapPort: number;
      imapUser: string;
      imapPass: string;
      imapTls?: boolean;
      imapFolder?: string;
      pollInterval?: number;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user);

    const service = new CreateImapMailbox(this.idGenerator, this.mailboxRepository);
    const mailbox = await service.execute({
      workspaceId,
      address: body.address,
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      imapUser: body.imapUser,
      imapPass: body.imapPass,
      imapTls: body.imapTls,
      imapFolder: body.imapFolder,
      pollInterval: body.pollInterval,
    });

    return {
      id: mailbox.getId(),
      address: mailbox.address,
      type: mailbox.type,
      isActive: mailbox.isActive,
    };
  }

  @Patch(':mailboxId')
  async update(
    @Param('slug') slug: string,
    @Param('mailboxId') mailboxId: string,
    @Body() body: {
      address?: string;
      isActive?: boolean;
      imapHost?: string | null;
      imapPort?: number | null;
      imapUser?: string | null;
      imapPass?: string | null;
      imapTls?: boolean | null;
      imapFolder?: string | null;
      pollInterval?: number | null;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user);

    const existing = await this.mailboxRepository.findById(mailboxId);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new EntityNotFoundError('Mailbox not found');
    }

    const service = new UpdateMailbox(this.mailboxRepository);
    const mailbox = await service.execute({ id: mailboxId, ...body });

    return {
      id: mailbox.getId(),
      address: mailbox.address,
      type: mailbox.type,
      isActive: mailbox.isActive,
    };
  }

  @Post('test-connection')
  async testConnection(
    @Param('slug') slug: string,
    @Body() body: {
      imapHost: string;
      imapPort: number;
      imapUser: string;
      imapPass: string;
      imapTls?: boolean;
      mailboxId?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user);

    // If password is empty or __keep__ and mailboxId provided, use the stored password
    let password = body.imapPass;
    if ((!password || password === '__keep__') && body.mailboxId) {
      const existing = await this.mailboxRepository.findById(body.mailboxId);
      if (existing && existing.workspaceId === workspaceId && existing.imapPass) {
        password = existing.imapPass;
      }
    }

    if (!password) {
      return { success: false, error: 'Password is required', folders: [] };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ImapFlow } = require('imapflow');

      const client = new ImapFlow({
        host: body.imapHost,
        port: body.imapPort,
        secure: body.imapTls ?? true,
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

      return { success: true, folders };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, error: msg, folders: [] };
    }
  }

  @Delete(':mailboxId')
  async remove(
    @Param('slug') slug: string,
    @Param('mailboxId') mailboxId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user);

    const existing = await this.mailboxRepository.findById(mailboxId);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new EntityNotFoundError('Mailbox not found');
    }

    const service = new DeleteMailbox(this.mailboxRepository);
    await service.execute(mailboxId);
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }

  private async ensurePermission(workspaceId: string, user: AuthUser) {
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
  }
}
