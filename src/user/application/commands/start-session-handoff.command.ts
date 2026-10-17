import { Command } from '../../../shared/domain/command';
import { StartSessionHandoff, StartSessionHandoffResult } from '../../domain/services/user-session-handoff-start';

interface Props {
  audience: string;
  codeChallenge: string;
  refreshToken: string | null;
  fromOrigin: string | null;
}

export class StartSessionHandoffCommand implements Command<Props, StartSessionHandoffResult> {
  constructor(private readonly startHandoff: StartSessionHandoff) {}

  execute(props: Props): Promise<StartSessionHandoffResult> {
    return this.startHandoff.execute({
      audience: props.audience,
      codeChallenge: props.codeChallenge,
      refreshToken: props.refreshToken,
      fromOrigin: props.fromOrigin,
    });
  }
}
