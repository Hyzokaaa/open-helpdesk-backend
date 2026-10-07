import { SortOptions } from '../../../shared/domain/sort-options';
import { Workspace } from '../entities/workspace';

export interface WorkspaceRepository {
  create(workspace: Workspace): Promise<void>;
  findById(id: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  findByCustomDomain(domain: string): Promise<Workspace[]>;
  findAll(sort?: SortOptions): Promise<Workspace[]>;
  update(workspace: Workspace): Promise<void>;
  /** Erases the workspace for good, deleted or not; its data goes with it. */
  delete(id: string): Promise<void>;
  /** Slugs stay taken by deleted workspaces until they are purged. */
  existsBySlug(slug: string): Promise<boolean>;
  /** Turns the workspace off until it is restored or purged. */
  softDelete(id: string, deletedById: string, purgeAt: Date): Promise<void>;
  restore(id: string): Promise<void>;
  /** A deleted workspace, waiting to be purged. */
  findDeletedById(id: string): Promise<Workspace | null>;
  /** Deleted workspaces, of one account or of all of them, soonest purge first. */
  findDeleted(accountId?: string): Promise<Workspace[]>;
  /** Deleted workspaces whose purge date has come. */
  findDueForPurge(now: Date): Promise<Workspace[]>;
  /** Deleted workspaces purged before the given date whose owner has not been reminded yet. */
  findDueForPurgeReminder(before: Date): Promise<Workspace[]>;
  markPurgeReminderSent(id: string, at: Date): Promise<void>;
  countByAccountId(accountId: string): Promise<number>;
  findByAccountIdOrderByCreatedAt(accountId: string): Promise<Workspace[]>;
}
