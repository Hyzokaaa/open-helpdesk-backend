import { Command } from '../../../shared/domain/command';
import { VerifyMatrixIdentity } from '../../domain/services/matrix-identity-verify';
import { MyMatrixIdentityView, myMatrixIdentityView } from '../queries/get-my-matrix.query';

export class VerifyMatrixIdentityCommand implements Command<{ userId: string; code: string }, MyMatrixIdentityView> {
  constructor(private readonly verify: VerifyMatrixIdentity) {}

  async execute(props: { userId: string; code: string }): Promise<MyMatrixIdentityView> {
    // Just verified, so never null
    return myMatrixIdentityView(await this.verify.execute(props))!;
  }
}
