import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  language: string;
  theme: string;
}

export class User {
  readonly id: Id;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  language: string;
  theme: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.email = props.email;
    this.password = props.password;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.isActive = props.isActive;
    this.isSystemAdmin = props.isSystemAdmin;
    this.language = props.language;
    this.theme = props.theme;
  }

  getId(): string {
    return this.id.get();
  }
}
