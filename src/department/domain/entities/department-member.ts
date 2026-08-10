import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  departmentId: string;
  userId: string;
}

export class DepartmentMember {
  readonly id: Id;
  departmentId: string;
  userId: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.departmentId = props.departmentId;
    this.userId = props.userId;
  }

  getId(): string {
    return this.id.get();
  }
}
