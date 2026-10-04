import { EntityNotFoundError } from '../../../shared/domain/errors';
import { DepartmentRepository } from '../repositories/department.repository';

interface DeleteDepartmentProps {
  id: string;
  /** The workspace of the caller; an item of any other workspace is not found. */
  workspaceId: string;
}

export class DeleteDepartment {
  constructor(private readonly repository: DepartmentRepository) {}

  async execute(props: DeleteDepartmentProps): Promise<void> {
    const department = await this.repository.findById(props.id);
    if (!department || department.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Department not found');
    }

    await this.repository.softDelete(props.id);
  }
}
