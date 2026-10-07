import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { WorkspaceLifecycleEvent } from '../domain/events';
import { WorkspaceLifecycleKind, WorkspaceLifecycleTemplate } from '../templates/workspace-lifecycle.template';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import { User } from '../../user/domain/entities/user';

/**
 * Tells people about a workspace being deleted, about to be purged, or restored. The owner can
 * undo a deletion and gets the link to do it; the workspace's admins are only informed. The
 * last reminder goes to the owner alone.
 */
@Injectable()
export class WorkspaceLifecycleHandler {
  private readonly logger = new Logger(WorkspaceLifecycleHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('workspace.deleted')
  async onDeleted(event: WorkspaceLifecycleEvent): Promise<void> {
    await this.notify('deleted', event, true);
  }

  @OnEvent('workspace.purge-reminder')
  async onReminder(event: WorkspaceLifecycleEvent): Promise<void> {
    await this.notify('reminder', event, false);
  }

  @OnEvent('workspace.restored')
  async onRestored(event: WorkspaceLifecycleEvent): Promise<void> {
    await this.notify('restored', event, true);
  }

  private async notify(kind: WorkspaceLifecycleKind, event: WorkspaceLifecycleEvent, includeAdmins: boolean): Promise<void> {
    try {
      const ownerId = await this.ownerOf(event.accountId);
      const adminIds = includeAdmins
        ? (await this.memberRepository.findByWorkspaceId(event.workspaceId))
            .filter((m) => m.role === WorkspaceRole.ADMIN)
            .map((m) => m.userId)
        : [];
      const ids = [...new Set([ownerId, ...adminIds].filter((id): id is string => !!id))];
      if (ids.length === 0) return;

      const users = (await this.userRepository.findByIds(ids)).filter((u) => u.isActive);
      const template = new WorkspaceLifecycleTemplate();
      for (const user of users) {
        const lang = user.language ?? 'en';
        const data = {
          kind,
          workspaceName: event.workspaceName,
          purgeDate: formatDate(event.purgeAt, lang),
          canRestore: user.getId() === ownerId,
          restoreUrl: `${this.frontendUrl}/dashboard/deleted-workspaces`,
          lang,
        };
        await this.send(user, template.subject(data), template.html(data));
      }
    } catch (err) {
      this.logger.error(`Workspace ${kind} email for ${event.workspaceId} failed: ${(err as Error).message}`);
    }
  }

  private async ownerOf(accountId: string | null): Promise<string | null> {
    if (!accountId) return null;
    const [row] = await this.dataSource.query(`SELECT "ownerId" FROM accounts WHERE id = $1`, [accountId]);
    return row?.ownerId ?? null;
  }

  private async send(user: User, subject: string, html: string): Promise<void> {
    await this.emailService.send({ to: user.email, subject, html });
  }
}

function formatDate(iso: string | null, lang: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
