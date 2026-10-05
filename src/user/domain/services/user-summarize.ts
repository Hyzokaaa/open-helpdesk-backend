import { UserRepository } from '../repositories/user.repository';

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Resolves the display name of a set of users in one lookup. Carries only the
 * name on purpose: it feeds responses read by members who may not see the
 * member list, so it must never expose an email or any other account field.
 */
export class SummarizeUsers {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(ids: (string | null | undefined)[]): Promise<Map<string, UserSummary>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    const users = await this.userRepository.findByIds(unique);
    return new Map(
      users.map((user) => [
        user.getId(),
        { id: user.getId(), firstName: user.firstName, lastName: user.lastName },
      ]),
    );
  }
}
