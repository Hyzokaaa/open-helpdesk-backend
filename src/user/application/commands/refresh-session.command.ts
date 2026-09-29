import { Command } from '../../../shared/domain/command';
import { RefreshUserSession } from '../../domain/services/user-session-refresh';

interface Props {
  refreshToken: string;
}

export interface RefreshSessionResponse {
  accessToken: string;
  /** Null when another tab already rotated the token: keep the stored one. */
  refreshToken: string | null;
}

export class RefreshSessionCommand implements Command<Props, RefreshSessionResponse> {
  constructor(private readonly refreshSession: RefreshUserSession) {}

  async execute(props: Props): Promise<RefreshSessionResponse> {
    const tokens = await this.refreshSession.execute({ refreshToken: props.refreshToken });
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }
}
