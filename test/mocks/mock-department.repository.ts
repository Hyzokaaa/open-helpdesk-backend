import { Department } from '../../src/department/domain/entities/department';
import { DepartmentMember } from '../../src/department/domain/entities/department-member';
import { DepartmentRepository } from '../../src/department/domain/repositories/department.repository';
import { DepartmentMemberRepository } from '../../src/department/domain/repositories/department-member.repository';

export class MockDepartmentRepository implements DepartmentRepository {
  departments: Department[] = [];

  async create(department: Department): Promise<void> {
    this.departments.push(department);
  }

  async findById(id: string): Promise<Department | null> {
    return this.departments.find((d) => d.getId() === id) ?? null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Department[]> {
    return this.departments.filter((d) => d.workspaceId === workspaceId);
  }

  async update(department: Department): Promise<void> {
    const i = this.departments.findIndex((d) => d.getId() === department.getId());
    if (i >= 0) this.departments[i] = department;
  }

  async softDelete(id: string): Promise<void> {
    this.departments = this.departments.filter((d) => d.getId() !== id);
  }
}

export class MockDepartmentMemberRepository implements DepartmentMemberRepository {
  members: DepartmentMember[] = [];

  async create(member: DepartmentMember): Promise<void> {
    this.members.push(member);
  }

  async delete(departmentId: string, userId: string): Promise<void> {
    this.members = this.members.filter((m) => !(m.departmentId === departmentId && m.userId === userId));
  }

  async findByDepartmentId(departmentId: string): Promise<DepartmentMember[]> {
    return this.members.filter((m) => m.departmentId === departmentId);
  }

  async findByUserId(userId: string): Promise<DepartmentMember[]> {
    return this.members.filter((m) => m.userId === userId);
  }

  async findByWorkspaceAndUser(_workspaceId: string, userId: string): Promise<DepartmentMember[]> {
    return this.members.filter((m) => m.userId === userId);
  }
}
