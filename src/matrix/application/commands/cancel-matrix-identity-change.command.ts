import { Command } from '../../../shared/domain/command';
import { CancelMatrixIdentityChange } from '../../domain/services/matrix-identity-change-cancel';
import { MyMatrixIdentityView, myMatrixIdentityView } from '../queries/get-my-matrix.query';

export class CancelMatrixIdentityChangeCommand implements Command<{ userId: string }, MyMatrixIdentityView | null> {
  constructor(private readonly cancel: CancelMatrixIdentityChange) {}

  async execute(props: { userId: string }): Promise<MyMatrixIdentityView | null> {
    return myMatrixIdentityView(await this.cancel.execute(props.userId));
  }
}
