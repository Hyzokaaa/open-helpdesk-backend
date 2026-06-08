import { IdGenerator } from '../../../shared/domain/id-generator';
import { PasswordHasher } from '../../../shared/domain/password-hasher';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { CreateUser } from '../../../user/domain/services/user-create';
import { AddWorkspaceMember } from './workspace-add-member';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { randomBytes } from 'crypto';

interface ImportRow {
  email: string;
  firstName: string;
  lastName: string;
  role: WorkspaceRole;
}

interface ConfirmImportProps {
  workspaceId: string;
  rows: ImportRow[];
  skipVerification: boolean;
}

interface CreatedUserInfo {
  userId: string;
  email: string;
  firstName: string;
}

interface ConfirmImportResult {
  created: number;
  added: number;
  skipped: number;
  createdUsers: CreatedUserInfo[];
}

export class ConfirmImportMembers {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly userRepository: UserRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(props: ConfirmImportProps): Promise<ConfirmImportResult> {
    const createUser = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
    const addMember = new AddWorkspaceMember(this.idGenerator, this.memberRepository);

    let created = 0;
    let added = 0;
    let skipped = 0;
    const createdUsers: CreatedUserInfo[] = [];

    for (const row of props.rows) {
      let user = await this.userRepository.findByEmail(row.email.toLowerCase());

      if (!user) {
        const randomPassword = randomBytes(24).toString('base64url');
        user = await createUser.execute({
          email: row.email.toLowerCase(),
          password: randomPassword,
          firstName: row.firstName,
          lastName: row.lastName,
          isEmailVerified: props.skipVerification,
          autoCreated: true,
        });
        created++;
        createdUsers.push({
          userId: user.getId(),
          email: user.email,
          firstName: user.firstName,
        });
      }

      const existingMember = await this.memberRepository.findByWorkspaceAndUser(
        props.workspaceId,
        user.getId(),
      );

      if (existingMember) {
        skipped++;
        continue;
      }

      await addMember.execute({
        workspaceId: props.workspaceId,
        userId: user.getId(),
        role: row.role,
      });
      added++;
    }

    return { created, added, skipped, createdUsers };
  }
}
