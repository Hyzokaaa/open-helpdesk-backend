import { DepartmentRepository } from '../../../department/domain/repositories/department.repository';
import { OrganizationRepository } from '../../../organization/domain/repositories/organization.repository';
import { ProjectRepository } from '../../../project/domain/repositories/project.repository';
import { MatrixRoomScope } from '../enums/matrix-room-scope.enum';
import { MatrixRoomScopeOf } from '../matrix-room-scope';

/** The name of the department, project or organization a room is for, if it is the workspace's and not deleted. */
export class FindMatrixRoomScope {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async execute(workspaceId: string, scope: MatrixRoomScopeOf): Promise<{ name: string } | null> {
    if (!scope.scopeId) return null;
    const found = await this.find(scope.scope, scope.scopeId);
    return found && found.workspaceId === workspaceId ? { name: found.name } : null;
  }

  private find(scope: MatrixRoomScope, id: string): Promise<{ workspaceId: string; name: string } | null> {
    switch (scope) {
      case MatrixRoomScope.DEPARTMENT: return this.departmentRepository.findById(id);
      case MatrixRoomScope.PROJECT: return this.projectRepository.findById(id);
      case MatrixRoomScope.ORGANIZATION: return this.organizationRepository.findById(id);
      default: return Promise.resolve(null);
    }
  }
}
