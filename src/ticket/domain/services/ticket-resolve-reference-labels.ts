import { TicketCategoryRepository } from '../../../project/domain/repositories/ticket-category.repository';
import { DepartmentRepository } from '../../../department/domain/repositories/department.repository';
import { ProjectRepository } from '../../../project/domain/repositories/project.repository';
import { OrganizationRepository } from '../../../organization/domain/repositories/organization.repository';
import { TagRepository } from '../../../tag/domain/repositories/tag.repository';

export interface TicketReferenceValues {
  categoryId?: string | null;
  departmentId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  tagIds?: string[];
}

interface Props {
  workspaceId: string;
  values: TicketReferenceValues;
}

/** Display names keyed by the reference field they describe (`categoryId` → category name). */
export type TicketReferenceLabels = Partial<Record<keyof TicketReferenceValues, string>>;

/**
 * Turns the ids a ticket points at into the names people know them by, so an audit entry can
 * say "Support" instead of a ULID and keep saying it after a rename or delete. Only fields
 * present in `values` are resolved; a null reference or empty tag list, an id that no longer exists or one that
 * belongs to another workspace gets no label, and a repository left out skips that field.
 */
export class ResolveTicketReferenceLabels {
  constructor(
    private readonly categoryRepository?: TicketCategoryRepository,
    private readonly departmentRepository?: DepartmentRepository,
    private readonly projectRepository?: ProjectRepository,
    private readonly organizationRepository?: OrganizationRepository,
    private readonly tagRepository?: TagRepository,
  ) {}

  async execute(props: Props): Promise<TicketReferenceLabels> {
    const { values, workspaceId } = props;
    const labels: TicketReferenceLabels = {};
    const inWorkspace = <T extends { workspaceId: string; name: string }>(item: T | null) =>
      item && item.workspaceId === workspaceId ? item.name : undefined;

    if (values.categoryId && this.categoryRepository) {
      const name = inWorkspace(await this.categoryRepository.findById(values.categoryId));
      if (name !== undefined) labels.categoryId = name;
    }
    if (values.departmentId && this.departmentRepository) {
      const name = inWorkspace(await this.departmentRepository.findById(values.departmentId));
      if (name !== undefined) labels.departmentId = name;
    }
    if (values.organizationId && this.organizationRepository) {
      const name = inWorkspace(await this.organizationRepository.findById(values.organizationId));
      if (name !== undefined) labels.organizationId = name;
    }
    if (values.projectId && this.projectRepository) {
      const name = inWorkspace(await this.projectRepository.findById(values.projectId));
      if (name !== undefined) labels.projectId = name;
    }
    if (values.tagIds?.length && this.tagRepository) {
      const tags = (await this.tagRepository.findByIds(values.tagIds)).filter((t) => t.workspaceId === workspaceId);
      const byId = new Map(tags.map((t) => [t.getId(), t.name]));
      const names = values.tagIds.map((id) => byId.get(id)).filter((name): name is string => !!name);
      if (names.length > 0) labels.tagIds = names.join(', ');
    }
    return labels;
  }
}
