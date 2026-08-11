import { DepartmentMember } from '../entities/department-member';

export interface DepartmentMemberRepository {
  create(member: DepartmentMember): Promise<void>;
  delete(departmentId: string, userId: string): Promise<void>;
  findByDepartmentId(departmentId: string): Promise<DepartmentMember[]>;
  findByUserId(userId: string): Promise<DepartmentMember[]>;
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<DepartmentMember[]>;
}
