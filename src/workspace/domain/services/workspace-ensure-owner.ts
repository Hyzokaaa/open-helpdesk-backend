import { AccessDeniedError } from '../../../shared/domain/errors';
import { AccountRepository } from '../../../account/domain/repositories/account.repository';
import { Workspace } from '../entities/workspace';

interface EnsureWorkspaceOwnerProps {
  workspace: Workspace;
  userId: string;
  isSystemAdmin: boolean;
}

/**
 * Deleting and restoring a workspace belong to whoever owns it: the owner of the account it was
 * created under (in the cloud, the customer; self-hosted, whoever created it), or a system admin.
 * Admins of the workspace who are not its owner cannot. A workspace with no account (created
 * before accounts existed, or imported) is the system admin's alone.
 */
export class EnsureWorkspaceOwner {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(props: EnsureWorkspaceOwnerProps): Promise<void> {
    if (props.isSystemAdmin) return;
    if (props.workspace.accountId) {
      const account = await this.accountRepository.findById(props.workspace.accountId);
      if (account && account.ownerId === props.userId) return;
    }
    throw new AccessDeniedError('Only the owner of this workspace or a system administrator can do this');
  }
}
