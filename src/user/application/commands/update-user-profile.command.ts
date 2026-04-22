import { Command } from '../../../shared/domain/command';
import { UpdateUserProfile } from '../../domain/services/user-update-profile';

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
  constructor(private readonly updateProfile: UpdateUserProfile) {}

  async execute(props: Props): Promise<UpdateUserProfileResponse> {
    const user = await this.updateProfile.execute({
      userId: props.userId,
      firstName: props.firstName,
      lastName: props.lastName,
      language: props.language,
      theme: props.theme,
    });

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      language: user.language,
      theme: user.theme,
    };
  }
}
