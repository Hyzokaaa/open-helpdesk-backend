import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketCategoryRepository } from '../../../project/domain/repositories/ticket-category.repository';
import { DepartmentRepository } from '../../../department/domain/repositories/department.repository';
import { ProjectRepository } from '../../../project/domain/repositories/project.repository';
import { OrganizationRepository } from '../../../organization/domain/repositories/organization.repository';
import { TagRepository } from '../../../tag/domain/repositories/tag.repository';

interface Props {
  workspaceId: string;
  categoryId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  organizationId?: string | null;
  tagIds?: string[];
}

/**
 * Every id a ticket points at must name something in the ticket's own workspace. An id that
 * is missing or belongs to another workspace is not found, so nothing links across tenants
 * through a category, department, project, organization or tag reference. `null` clears a
 * reference and is not checked; a repository left out skips that reference.
 */
export class EnsureTicketReferences {
  constructor(
    private readonly categoryRepository?: TicketCategoryRepository,
    private readonly departmentRepository?: DepartmentRepository,
    private readonly projectRepository?: ProjectRepository,
    private readonly organizationRepository?: OrganizationRepository,
    private readonly tagRepository?: TagRepository,
  ) {}

  async execute(props: Props): Promise<void> {
    if (props.categoryId && this.categoryRepository) {
      const category = await this.categoryRepository.findById(props.categoryId);
      if (!category || category.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Category not found');
    }
    if (props.departmentId && this.departmentRepository) {
      const department = await this.departmentRepository.findById(props.departmentId);
      if (!department || department.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Department not found');
    }
    if (props.projectId && this.projectRepository) {
      const project = await this.projectRepository.findById(props.projectId);
      if (!project || project.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Project not found');
    }
    if (props.organizationId && this.organizationRepository) {
      const organization = await this.organizationRepository.findById(props.organizationId);
      if (!organization || organization.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Organization not found');
    }
    if (props.tagIds?.length && this.tagRepository) {
      const tags = await this.tagRepository.findByIds(props.tagIds);
      const known = new Set(tags.filter((t) => t.workspaceId === props.workspaceId).map((t) => t.getId()));
      if (props.tagIds.some((id) => !known.has(id))) throw new EntityNotFoundError('Tag not found');
    }
  }
}
