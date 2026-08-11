import { EntityNotFoundError } from '../../../shared/domain/errors';
import { DepartmentRepository } from '../repositories/department.repository';
import { Department } from '../entities/department';

interface UpdateDepartmentProps {
  id: string;
  name?: string;
  description?: string | null;
}

export class UpdateDepartment {
  constructor(private readonly repository: DepartmentRepository) {}

  async execute(props: UpdateDepartmentProps): Promise<Department> {
    const department = await this.repository.findById(props.id);
    if (!department) {
      throw new EntityNotFoundError('Department not found');
    }

    if (props.name !== undefined) department.name = props.name;
    if (props.description !== undefined) department.description = props.description;

    await this.repository.update(department);
    return department;
  }
}
