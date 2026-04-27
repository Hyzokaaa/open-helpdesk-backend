import { SortOptions } from '../../../shared/domain/sort-options';
import { Workspace } from '../entities/workspace';

export interface WorkspaceRepository {
  create(workspace: Workspace): Promise<void>;
  findById(id: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  findAll(sort?: SortOptions): Promise<Workspace[]>;
  update(workspace: Workspace): Promise<void>;
  delete(id: string): Promise<void>;
  existsBySlug(slug: string): Promise<boolean>;
  countByAccountId(accountId: string): Promise<number>;
}
