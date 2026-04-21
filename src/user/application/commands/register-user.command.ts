import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { CreateUser } from '../../domain/services/user-create';

interface Props {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isSystemAdmin?: boolean;
  requestingUserIsAdmin: boolean;
}

export interface RegisterUserResponse {
  id: string;
  email: string;
}

export class RegisterUserCommand implements Command<Props, RegisterUserResponse> {
  constructor(private readonly createUser: CreateUser) {}

  async execute(props: Props): Promise<RegisterUserResponse> {
    if (!props.requestingUserIsAdmin) {
      throw new AccessDeniedError('Only system admins can create users');
    }

    const user = await this.createUser.execute({
      email: props.email,
      password: props.password,
      firstName: props.firstName,
      lastName: props.lastName,
      isSystemAdmin: props.isSystemAdmin,
    });

    return { id: user.getId(), email: user.email };
  }
}
