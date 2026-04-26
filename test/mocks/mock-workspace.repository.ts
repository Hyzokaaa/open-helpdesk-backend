import { Workspace } from '../../src/workspace/domain/entities/workspace';
import { WorkspaceRepository } from '../../src/workspace/domain/repositories/workspace.repository';

export class MockWorkspaceRepository implements WorkspaceRepository {
  private workspaces: Workspace[] = [];

  async create(workspace: Workspace): Promise<void> {
    this.workspaces.push(workspace);
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaces.find((w) => w.getId() === id) ?? null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.workspaces.find((w) => w.slug === slug) ?? null;
  }

  async findAll(): Promise<Workspace[]> {
    return this.workspaces;
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
    return this.workspaces.filter((w) => w.accountId === accountId).length;
  }

  seed(workspace: Workspace): void {
    this.workspaces.push(workspace);
  }
}
