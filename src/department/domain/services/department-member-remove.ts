import { DepartmentMemberRepository } from '../repositories/department-member.repository';

interface RemoveDepartmentMemberProps {
  departmentId: string;
  userId: string;
}

export class RemoveDepartmentMember {
  constructor(private readonly repository: DepartmentMemberRepository) {}

  async execute(props: RemoveDepartmentMemberProps): Promise<void> {
    await this.repository.delete(props.departmentId, props.userId);
  }
}
