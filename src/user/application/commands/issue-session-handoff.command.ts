import { Command } from '../../../shared/domain/command';
import { IssueSessionHandoff } from '../../domain/services/user-session-handoff-issue';

interface Props {
  userId: string;
  sessionId?: string;
  audience: string;
  codeChallenge: string;
  fromOrigin: string | null;
}

export interface IssueSessionHandoffResponse {
  /** Thirty-second, single-use code for the receiving address; it travels in the redirect URL. */
  code: string;
}

export class IssueSessionHandoffCommand implements Command<Props, IssueSessionHandoffResponse> {
  constructor(private readonly issueHandoff: IssueSessionHandoff) {}

  async execute(props: Props): Promise<IssueSessionHandoffResponse> {
    const code = await this.issueHandoff.execute({
      userId: props.userId,
      sessionId: props.sessionId,
      audience: props.audience,
      codeChallenge: props.codeChallenge,
      fromOrigin: props.fromOrigin,
    });
    return { code };
  }
}
