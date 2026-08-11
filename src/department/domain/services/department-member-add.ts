import { IdGenerator } from '../../../shared/domain/id-generator';
import { DepartmentMember } from '../entities/department-member';
import { DepartmentMemberRepository } from '../repositories/department-member.repository';

interface AddDepartmentMemberProps {
  departmentId: string;
  userId: string;
}

export class AddDepartmentMember {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: DepartmentMemberRepository,
  ) {}

  async execute(props: AddDepartmentMemberProps): Promise<DepartmentMember> {
    const member = new DepartmentMember({
      id: this.idGenerator.create(),
      departmentId: props.departmentId,
      userId: props.userId,
    });

    await this.repository.create(member);
    return member;
  }
}
