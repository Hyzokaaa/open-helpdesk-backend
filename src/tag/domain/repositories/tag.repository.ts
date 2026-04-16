import { Tag } from '../entities/tag';

export interface TagRepository {
  create(tag: Tag): Promise<void>;
  findById(id: string): Promise<Tag | null>;
  findByIds(ids: string[]): Promise<Tag[]>;
  findByWorkspaceId(workspaceId: string): Promise<Tag[]>;
  delete(id: string): Promise<void>;
}
