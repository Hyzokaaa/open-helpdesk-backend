import { IdGenerator } from '../../../shared/domain/id-generator';
import { Department } from '../entities/department';
import { DepartmentRepository } from '../repositories/department.repository';

interface CreateDepartmentProps {
  name: string;
  description: string | null;
  workspaceId: string;
}

export class CreateDepartment {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: DepartmentRepository,
  ) {}

  async execute(props: CreateDepartmentProps): Promise<Department> {
    const department = new Department({
      id: this.idGenerator.create(),
      name: props.name,
      description: props.description,
      workspaceId: props.workspaceId,
    });

    await this.repository.create(department);
    return department;
  }
}
