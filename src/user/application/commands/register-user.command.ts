import { Command } from '../../../shared/domain/command';
import { CreateUser } from '../../domain/services/user-create';

interface Props {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RegisterUserResponse {
  id: string;
  email: string;
}

export class RegisterUserCommand implements Command<Props, RegisterUserResponse> {
  constructor(private readonly createUser: CreateUser) {}

  async execute(props: Props): Promise<RegisterUserResponse> {
    const user = await this.createUser.execute({
      email: props.email,
      password: props.password,
      firstName: props.firstName,
      lastName: props.lastName,
    });

    return { id: user.getId(), email: user.email };
  }
}
