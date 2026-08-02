import { EntityNotFoundError } from '../../../shared/domain/errors';
import { User } from '../entities/user';
import { UserRepository } from '../repositories/user.repository';

interface UpdateProfileProps {
  userId: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  theme?: string;
  dateFormat?: string;
}

export class UpdateUserProfile {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: UpdateProfileProps): Promise<User> {
    const user = await this.repository.findById(props.userId);
    if (!user) throw new EntityNotFoundError('User not found');

    if (props.firstName !== undefined) user.firstName = props.firstName;
    if (props.lastName !== undefined) user.lastName = props.lastName;
    if (props.language !== undefined) user.language = props.language;
    if (props.theme !== undefined) user.theme = props.theme;
    if (props.dateFormat !== undefined) user.dateFormat = props.dateFormat;

    await this.repository.update(user);
    return user;
  }
}
