import { Tag } from '../../src/tag/domain/entities/tag';
import { TagRepository } from '../../src/tag/domain/repositories/tag.repository';

export class MockTagRepository implements TagRepository {
  private tags: Tag[] = [];

  async create(tag: Tag): Promise<void> {
    this.tags.push(tag);
  }

  async findById(id: string): Promise<Tag | null> {
    return this.tags.find((t) => t.getId() === id) ?? null;
  }

  async findByIds(ids: string[]): Promise<Tag[]> {
    return this.tags.filter((t) => ids.includes(t.getId()));
  }

  async findByWorkspaceId(workspaceId: string): Promise<Tag[]> {
    return this.tags.filter((t) => t.workspaceId === workspaceId);
  }

  async delete(id: string): Promise<void> {
    this.tags = this.tags.filter((t) => t.getId() !== id);
  }

  seed(tag: Tag): void {
    this.tags.push(tag);
  }
}
