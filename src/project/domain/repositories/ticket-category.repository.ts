import { TicketCategory } from '../entities/ticket-category';

export interface TicketCategoryRepository {
  create(category: TicketCategory): Promise<void>;
  createMany(categories: TicketCategory[]): Promise<void>;
  findById(id: string): Promise<TicketCategory | null>;
  findByWorkspaceId(workspaceId: string): Promise<TicketCategory[]>;
  findByProjectId(projectId: string): Promise<TicketCategory[]>;
  findGlobalByWorkspaceId(workspaceId: string): Promise<TicketCategory[]>;
  findBySlugAndWorkspace(slug: string, workspaceId: string): Promise<TicketCategory | null>;
  update(category: TicketCategory): Promise<void>;
  delete(id: string): Promise<void>;
}
