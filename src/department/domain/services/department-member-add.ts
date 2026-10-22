import { IdGenerator } from '../../../shared/domain/id-generator';
import { DepartmentMember } from '../entities/department-member';
import { DepartmentMemberRepository } from '../repositories/department-member.repository';
import { DepartmentRepository } from '../repositories/department.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { ConflictError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { DEPARTMENT_ROLES } from './department-members-set';

interface AddDepartmentMemberProps {
  departmentId: string;
  userId: string;
  /** The department must be of this workspace, and the person a member of it. */
  workspaceId: string;
}

export class AddDepartmentMember {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: DepartmentMemberRepository,
    private readonly departmentRepository: DepartmentRepository,
    private readonly workspaceMemberRepository: WorkspaceMemberRepository,
  ) {}

  async execute(props: AddDepartmentMemberProps): Promise<DepartmentMember> {
    const department = await this.departmentRepository.findById(props.departmentId);
    if (!department || department.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Department not found');
    }
    const workspaceMember = await this.workspaceMemberRepository.findByWorkspaceAndUser(props.workspaceId, props.userId);
    if (!workspaceMember) throw new EntityNotFoundError('Member not found');
    if (!DEPARTMENT_ROLES.includes(workspaceMember.role)) {
      throw new DomainValidationError('Only admins, supervisors and agents can be in a department');
    }
    const current = await this.repository.findByDepartmentId(props.departmentId);
    if (current.some((m) => m.userId === props.userId)) throw new ConflictError('Already in this department');

    const member = new DepartmentMember({
      id: this.idGenerator.create(),
      departmentId: props.departmentId,
      userId: props.userId,
    });

    await this.repository.create(member);
    return member;
  }
}
