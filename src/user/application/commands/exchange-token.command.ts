import { TokenService } from '../../../shared/domain/token-service';
import { Command } from '../../../shared/domain/command';
import { ExchangeToken } from '../../domain/services/user-exchange-token';
import { AddWorkspaceMember } from '../../../workspace/domain/services/workspace-add-member';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

interface Props {
  email: string;
  firstName: string;
  lastName: string;
  role: WorkspaceRole;
  workspaceId: string;
}

export interface ExchangeTokenResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export class ExchangeTokenCommand implements Command<Props, ExchangeTokenResponse> {
  constructor(
    private readonly exchangeToken: ExchangeToken,
    private readonly addWorkspaceMember: AddWorkspaceMember,
    private readonly tokenService: TokenService,
  ) {}

  async execute(props: Props): Promise<ExchangeTokenResponse> {
    const user = await this.exchangeToken.execute({
      email: props.email,
      firstName: props.firstName,
      lastName: props.lastName,
    });

    try {
      await this.addWorkspaceMember.execute({
        workspaceId: props.workspaceId,
        userId: user.getId(),
        role: props.role,
      });
    } catch {
      // Already a member — ignore
    }

    const payload = {
      sub: user.getId(),
      email: user.email,
      isSystemAdmin: user.isSystemAdmin,
      isEmailVerified: user.isEmailVerified,
    };
    const accessToken = this.tokenService.sign(payload);

    return {
      accessToken,
      user: { id: user.getId(), email: user.email },
    };
  }
}
