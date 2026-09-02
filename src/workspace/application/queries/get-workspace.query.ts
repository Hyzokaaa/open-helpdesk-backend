import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository';
import { MailboxRepository } from '../../../mailbox/domain/repositories/mailbox.repository';

interface Props {
  slug: string;
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
}

export class GetWorkspaceQuery implements Query<Props, WorkspaceResponse> {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly mailboxRepository?: MailboxRepository,
  ) {}

  async execute(props: Props): Promise<WorkspaceResponse> {
    const workspace = await this.repository.findBySlug(props.slug);
    if (!workspace) {
      throw new EntityNotFoundError('Workspace not found');
    }

    const mailbox = this.mailboxRepository
      ? await this.mailboxRepository.findByWorkspaceId(workspace.getId())
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
    };
  }
}
