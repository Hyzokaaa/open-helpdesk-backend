import { DepartmentMemberRepository } from '../repositories/department-member.repository';
import { DepartmentRepository } from '../repositories/department.repository';
import { EntityNotFoundError } from '../../../shared/domain/errors';

interface RemoveDepartmentMemberProps {
  departmentId: string;
  userId: string;
  workspaceId: string;
}

export class RemoveDepartmentMember {
  constructor(
    private readonly repository: DepartmentMemberRepository,
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  async execute(props: RemoveDepartmentMemberProps): Promise<void> {
    const department = await this.departmentRepository.findById(props.departmentId);
    if (!department || department.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Department not found');
    }
    await this.repository.delete(props.departmentId, props.userId);
  }
}
