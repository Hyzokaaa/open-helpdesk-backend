import { Id } from '../../../shared/domain/id';
import { UserSignupMethod } from '../enums/user-signup-method.enum';
import { UserSignupSource } from '../user-signup-source';

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
  dateFormat?: string;
  timezone?: string;
  autoCreated?: boolean;
  authProvider?: string | null;
  avatarKey?: string | null;
  signupMethod?: UserSignupMethod | null;
  signupSource?: UserSignupSource | null;
  createdAt?: Date | null;
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
  dateFormat: string;
  timezone: string;
  autoCreated: boolean;
  authProvider: string | null;
  avatarKey: string | null;
  signupMethod: UserSignupMethod | null;
  signupSource: UserSignupSource | null;
  /** Set by the database; the signup source is only accepted shortly after it */
  readonly createdAt: Date | null;

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
    this.dateFormat = props.dateFormat ?? 'DD/MM/YYYY';
    this.timezone = props.timezone ?? 'auto';
    this.autoCreated = props.autoCreated ?? false;
    this.authProvider = props.authProvider ?? null;
    this.avatarKey = props.avatarKey ?? null;
    this.signupMethod = props.signupMethod ?? null;
    this.signupSource = props.signupSource ?? null;
    this.createdAt = props.createdAt ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
