import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { UserRepository } from '../../domain/repositories/user.repository';

interface Props {
  userId: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  theme?: string;
}

export interface UpdateUserProfileResponse {
  firstName: string;
  lastName: string;
  language: string;
  theme: string;
}

export class UpdateUserProfileCommand implements Command<Props, UpdateUserProfileResponse> {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: Props): Promise<UpdateUserProfileResponse> {
    const user = await this.repository.findById(props.userId);
    if (!user) throw new EntityNotFoundError('User not found');

    if (props.firstName !== undefined) user.firstName = props.firstName;
    if (props.lastName !== undefined) user.lastName = props.lastName;
    if (props.language !== undefined) user.language = props.language;
    if (props.theme !== undefined) user.theme = props.theme;

    await this.repository.update(user);

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      language: user.language,
      theme: user.theme,
    };
  }
}
