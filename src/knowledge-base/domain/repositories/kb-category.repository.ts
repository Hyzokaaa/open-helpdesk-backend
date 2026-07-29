import { KbCategory } from '../entities/kb-category';

export interface KbCategoryRepository {
  create(category: KbCategory): Promise<void>;
  findById(id: string): Promise<KbCategory | null>;
  findByWorkspaceId(workspaceId: string): Promise<KbCategory[]>;
  findBySlugAndWorkspaceId(slug: string, workspaceId: string): Promise<KbCategory | null>;
  update(category: KbCategory): Promise<void>;
  delete(id: string): Promise<void>;
  updatePositions(items: Array<{ id: string; position: number }>): Promise<void>;
  getMaxPosition(workspaceId: string): Promise<number>;
}
