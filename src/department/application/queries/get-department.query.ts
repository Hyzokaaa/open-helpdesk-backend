import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { DepartmentRepository } from '../../domain/repositories/department.repository';
import { DepartmentMemberRepository } from '../../domain/repositories/department-member.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  departmentId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface DepartmentMemberDetail {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface DepartmentDetailResponse {
  id: string;
  name: string;
  description: string | null;
  members: DepartmentMemberDetail[];
}

export class GetDepartmentQuery implements Query<Props, DepartmentDetailResponse> {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly memberRepository: DepartmentMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<DepartmentDetailResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.DEPARTMENT_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const department = await this.departmentRepository.findById(props.departmentId);
    if (!department || department.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Department not found');
    }

    const departmentMembers = await this.memberRepository.findByDepartmentId(props.departmentId);
    const members: DepartmentMemberDetail[] = [];

    for (const dm of departmentMembers) {
      const user = await this.userRepository.findById(dm.userId);
      if (user) {
        members.push({
          userId: user.getId(),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        });
      }
    }

    return {
      id: department.getId(),
      name: department.name,
      description: department.description,
      members,
    };
  }
}
