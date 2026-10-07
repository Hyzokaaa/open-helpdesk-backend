import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketReferenceFormat, ticketReferenceFormatOf } from '../../../ticket/domain/ticket-reference';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceTicketReferenceRepository } from '../repositories/workspace-ticket-reference.repository';
import { TicketReferenceRewriter } from '../ticket-reference-rewriter';

interface Props {
  workspaceId: string;
  /** The workspace's name, typed by whoever converts to confirm. */
  confirmName: string;
}

/**
 * Gives every existing ticket the reference it would have in the workspace's current format.
 * A format change otherwise applies to new tickets only. The old references stop leading to their
 * tickets (emails, links, notes that quote them), which is why it takes the workspace's name.
 */
export class ConvertTicketReferences {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly referenceRepository: WorkspaceTicketReferenceRepository,
    private readonly rewriter: TicketReferenceRewriter,
  ) {}

  async execute(props: Props): Promise<{ converted: number; format: TicketReferenceFormat }> {
    const workspace = await this.workspaceRepository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    if (normalizeName(props.confirmName) !== normalizeName(workspace.name)) {
      throw new DomainValidationError('Type the name of the workspace to confirm');
    }

    const format = ticketReferenceFormatOf(await this.referenceRepository.findByWorkspaceId(props.workspaceId));
    const converted = await this.rewriter.rewriteAll(props.workspaceId, format);
    return { converted, format };
  }
}

function normalizeName(name: string | null | undefined): string {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
