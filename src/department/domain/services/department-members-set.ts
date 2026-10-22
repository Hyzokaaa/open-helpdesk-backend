import { IdGenerator } from '../../../shared/domain/id-generator';
import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { DepartmentMember } from '../entities/department-member';
import { DepartmentMemberRepository } from '../repositories/department-member.repository';
import { DepartmentRepository } from '../repositories/department.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

/** Who can be in a department: the team, not the requesters (the User role). */
export const DEPARTMENT_ROLES: WorkspaceRole[] = [WorkspaceRole.ADMIN, WorkspaceRole.SUPERVISOR, WorkspaceRole.AGENT];

interface SetDepartmentMembersProps {
  departmentId: string;
  /** The department must be of this workspace, and each person a member of it with a team role. */
  workspaceId: string;
  /** The whole list of agents the department ends up with. */
  userIds: string[];
}

export interface DepartmentMembersChange {
  added: string[];
  removed: string[];
}

/**
 * Replaces the agents of a department with a list: adds who is missing and removes who is no
 * longer there. Everyone added is checked before anything is written, so a bad id changes nothing;
 * someone already in it stays even if their role changed since, until they are taken out.
 */
export class SetDepartmentMembers {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: DepartmentMemberRepository,
    private readonly departmentRepository: DepartmentRepository,
    private readonly workspaceMemberRepository: WorkspaceMemberRepository,
  ) {}

  /** The ids without repeats, once each is known to be a member of the workspace with a team role. */
  async ensureEligible(workspaceId: string, userIds: string[]): Promise<string[]> {
    const unique = [...new Set(userIds)];
    for (const userId of unique) {
      const member = await this.workspaceMemberRepository.findByWorkspaceAndUser(workspaceId, userId);
      if (!member) throw new EntityNotFoundError('Member not found');
      if (!DEPARTMENT_ROLES.includes(member.role)) {
        throw new DomainValidationError('Only admins, supervisors and agents can be in a department');
      }
    }
    return unique;
  }

  async execute(props: SetDepartmentMembersProps): Promise<DepartmentMembersChange> {
    const department = await this.departmentRepository.findById(props.departmentId);
    if (!department || department.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Department not found');
    }
    const current = (await this.repository.findByDepartmentId(props.departmentId)).map((m) => m.userId);
    const wanted = [...new Set(props.userIds)];
    const added = await this.ensureEligible(props.workspaceId, wanted.filter((id) => !current.includes(id)));
    const removed = current.filter((id) => !wanted.includes(id));
    for (const userId of added) {
      await this.repository.create(new DepartmentMember({ id: this.idGenerator.create(), departmentId: props.departmentId, userId }));
    }
    for (const userId of removed) {
      await this.repository.delete(props.departmentId, userId);
    }
    return { added, removed };
  }
}
