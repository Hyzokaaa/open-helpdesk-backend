import { Query } from '../../../shared/domain/query';
import { DepartmentRepository } from '../../domain/repositories/department.repository';
import { DepartmentMemberRepository } from '../../domain/repositories/department-member.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface DepartmentListItem {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
}

export class ListDepartmentsQuery implements Query<Props, DepartmentListItem[]> {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly memberRepository: DepartmentMemberRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<DepartmentListItem[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.DEPARTMENT_VIEW,
      isSystemAdmin: props.isSystemAdmin,
    });

    const departments = await this.departmentRepository.findByWorkspaceId(props.workspaceId);
    const result: DepartmentListItem[] = [];

    for (const dept of departments) {
      const members = await this.memberRepository.findByDepartmentId(dept.getId());
      result.push({
        id: dept.getId(),
        name: dept.name,
        description: dept.description,
        memberCount: members.length,
      });
    }

    return result;
  }
}
