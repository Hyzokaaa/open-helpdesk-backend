import { Query } from '../../../shared/domain/query';
import { DepartmentRepository } from '../../domain/repositories/department.repository';
import { DepartmentMemberRepository } from '../../domain/repositories/department-member.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
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
  /** Its agents by name, for the avatars in the list; present when the query can read users. */
  members?: { userId: string; firstName: string; lastName: string }[];
  /** Whether the caller is one of its agents ("My departments"). */
  isMember: boolean;
}

export class ListDepartmentsQuery implements Query<Props, DepartmentListItem[]> {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly memberRepository: DepartmentMemberRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly userRepository?: UserRepository,
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
    const names = new Map<string, { firstName: string; lastName: string } | null>();
    const nameOf = async (userId: string) => {
      if (!names.has(userId)) {
        const user = await this.userRepository!.findById(userId);
        names.set(userId, user ? { firstName: user.firstName, lastName: user.lastName } : null);
      }
      return names.get(userId)!;
    };

    for (const dept of departments) {
      const members = await this.memberRepository.findByDepartmentId(dept.getId());
      const item: DepartmentListItem = {
        id: dept.getId(),
        name: dept.name,
        description: dept.description,
        memberCount: members.length,
        isMember: members.some((m) => m.userId === props.userId),
      };
      if (this.userRepository) {
        item.members = [];
        for (const m of members) {
          const name = await nameOf(m.userId);
          if (name) item.members.push({ userId: m.userId, ...name });
        }
      }
      result.push(item);
    }

    return result;
  }
}
