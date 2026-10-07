import { Workspace } from '../../src/workspace/domain/entities/workspace';
import { WorkspaceRepository } from '../../src/workspace/domain/repositories/workspace.repository';

export class MockWorkspaceRepository implements WorkspaceRepository {
  private workspaces: Workspace[] = [];

  async create(workspace: Workspace): Promise<void> {
    this.workspaces.push(workspace);
  }

  /** Like the real repository, ordinary lookups do not see deleted workspaces. */
  private get live(): Workspace[] {
    return this.workspaces.filter((w) => !w.deletedAt);
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.live.find((w) => w.getId() === id) ?? null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.live.find((w) => w.slug === slug) ?? null;
  }

  async findByCustomDomain(domain: string): Promise<Workspace[]> {
    return this.live.filter((w) => w.customDomain === domain);
  }

  async findAll(): Promise<Workspace[]> {
    return this.live;
  }

  async softDelete(id: string, deletedById: string, purgeAt: Date): Promise<void> {
    const workspace = this.workspaces.find((w) => w.getId() === id);
    if (!workspace) return;
    workspace.deletedAt = new Date();
    workspace.deletedById = deletedById;
    workspace.purgeAt = purgeAt;
    workspace.purgeReminderSentAt = null;
  }

  async restore(id: string): Promise<void> {
    const workspace = this.workspaces.find((w) => w.getId() === id);
    if (!workspace) return;
    workspace.deletedAt = null;
    workspace.deletedById = null;
    workspace.purgeAt = null;
    workspace.purgeReminderSentAt = null;
  }

  async findDeletedById(id: string): Promise<Workspace | null> {
    return this.workspaces.find((w) => w.getId() === id && !!w.deletedAt) ?? null;
  }

  async findDeleted(accountId?: string): Promise<Workspace[]> {
    return this.workspaces.filter((w) => !!w.deletedAt && (!accountId || w.accountId === accountId));
  }

  async findDueForPurge(now: Date): Promise<Workspace[]> {
    return this.workspaces.filter((w) => !!w.deletedAt && !!w.purgeAt && w.purgeAt <= now);
  }

  async findDueForPurgeReminder(before: Date): Promise<Workspace[]> {
    return this.workspaces.filter((w) => !!w.deletedAt && !!w.purgeAt && w.purgeAt <= before && !w.purgeReminderSentAt);
  }

  async markPurgeReminderSent(id: string, at: Date): Promise<void> {
    const workspace = this.workspaces.find((w) => w.getId() === id);
    if (workspace) workspace.purgeReminderSentAt = at;
  }

  async update(workspace: Workspace): Promise<void> {
    const index = this.workspaces.findIndex((w) => w.getId() === workspace.getId());
    if (index >= 0) this.workspaces[index] = workspace;
  }

  async delete(id: string): Promise<void> {
    this.workspaces = this.workspaces.filter((w) => w.getId() !== id);
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return this.workspaces.some((w) => w.slug === slug);
  }

  async countByAccountId(accountId: string): Promise<number> {
    return this.live.filter((w) => w.accountId === accountId).length;
  }

  async findByAccountIdOrderByCreatedAt(accountId: string): Promise<Workspace[]> {
    return this.workspaces.filter((w) => w.accountId === accountId);
  }

  seed(workspace: Workspace): void {
    this.workspaces.push(workspace);
  }
}
