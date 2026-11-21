import { Command } from '../../../shared/domain/command';
import { StartMatrixIdentityVerification } from '../../domain/services/matrix-identity-start';
import { MyMatrixIdentityView, myMatrixIdentityView } from '../queries/get-my-matrix.query';

interface Props {
  userId: string;
  matrixUserId: string;
  lang: string | null;
}

export class StartMatrixIdentityCommand implements Command<Props, MyMatrixIdentityView> {
  constructor(private readonly start: StartMatrixIdentityVerification) {}

  async execute(props: Props): Promise<MyMatrixIdentityView> {
    // Just given an ID, so never null
    return myMatrixIdentityView(await this.start.execute(props))!;
  }
}
