import { NotFoundException } from '@nestjs/common';
import { Query } from '../../../shared/domain/query';
import { UserRepository } from '../../domain/repositories/user.repository';

interface Props {
  userId: string;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  language: string;
}

export class GetUserProfileQuery implements Query<Props, UserProfileResponse> {
  constructor(private readonly repository: UserRepository) {}

  async execute(props: Props): Promise<UserProfileResponse> {
    const user = await this.repository.findById(props.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.getId(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isSystemAdmin: user.isSystemAdmin,
      language: user.language,
    };
  }
}
