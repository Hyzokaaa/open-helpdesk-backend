import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository';
import { MailboxRepository } from '../../../mailbox/domain/repositories/mailbox.repository';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { AccountRepository } from '../../../account/domain/repositories/account.repository';
import { WorkspaceTicketReferenceRepository } from '../../domain/repositories/workspace-ticket-reference.repository';

interface Props {
  slug: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
  palette: string | null;
  supportEmail: string | null;
  systemMailboxEnabled: boolean;
  customDomain: string | null;
  customDomainVerified: boolean;
  domainVerificationToken: string | null;
  appName: string | null;
  appSubtitle: string | null;
  logo: string | null;
  icon: string | null;
  /** Whether the caller owns it: only the owner (or a system admin) can delete it. */
  isOwner: boolean;
  ticketReference: { style: string; prefix: string };
}

export class GetWorkspaceQuery implements Query<Props, WorkspaceResponse> {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly mailboxRepository?: MailboxRepository,
    private readonly accountRepository?: AccountRepository,
    private readonly ticketReferenceRepository?: WorkspaceTicketReferenceRepository,
  ) {}

  async execute(props: Props): Promise<WorkspaceResponse> {
    const workspace = await this.repository.findBySlug(props.slug);
    if (!workspace) {
      throw new EntityNotFoundError('Workspace not found');
    }

    // Membership only: the public branding a non-member needs comes from /internal/resolve-domain.
    await this.ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: props.userId,
      isSystemAdmin: props.isSystemAdmin,
    });

    const mailbox = this.mailboxRepository
      ? await this.mailboxRepository.findByWorkspaceId(workspace.getId())
      : null;

    const account = workspace.accountId && this.accountRepository
      ? await this.accountRepository.findById(workspace.accountId)
      : null;

    const reference = this.ticketReferenceRepository
      ? await this.ticketReferenceRepository.findByWorkspaceId(workspace.getId())
      : null;

    return {
      id: workspace.getId(),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      palette: workspace.palette,
      supportEmail: mailbox?.address ?? null,
      systemMailboxEnabled: workspace.systemMailboxEnabled,
      customDomain: workspace.customDomain,
      customDomainVerified: workspace.customDomainVerified,
      domainVerificationToken: workspace.domainVerificationToken,
      appName: workspace.appName,
      appSubtitle: workspace.appSubtitle,
      logo: workspace.logo,
      icon: workspace.icon,
      isOwner: !!account && account.ownerId === props.userId,
      ticketReference: { style: reference?.style ?? 'sequential', prefix: reference?.prefix ?? 'TK' },
    };
  }
}
