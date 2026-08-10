import { Department } from '../entities/department';

export interface DepartmentRepository {
  create(department: Department): Promise<void>;
  findById(id: string): Promise<Department | null>;
  findByWorkspaceId(workspaceId: string): Promise<Department[]>;
  update(department: Department): Promise<void>;
  softDelete(id: string): Promise<void>;
}
