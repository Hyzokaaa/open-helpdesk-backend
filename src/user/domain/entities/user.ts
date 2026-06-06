import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
  language: string;
  theme: string;
  autoCreated?: boolean;
  authProvider?: string | null;
}

export class User {
  readonly id: Id;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
  language: string;
  theme: string;
  autoCreated: boolean;
  authProvider: string | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.email = props.email;
    this.password = props.password;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.isActive = props.isActive;
    this.isSystemAdmin = props.isSystemAdmin;
    this.isEmailVerified = props.isEmailVerified;
    this.language = props.language;
    this.theme = props.theme;
    this.autoCreated = props.autoCreated ?? false;
    this.authProvider = props.authProvider ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
