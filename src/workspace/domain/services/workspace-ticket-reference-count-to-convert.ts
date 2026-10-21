import { ticketReferenceFormatOf } from '../../../ticket/domain/ticket-reference';
import { WorkspaceTicketReferenceRepository } from '../repositories/workspace-ticket-reference.repository';
import { TicketReferenceRewriter } from '../ticket-reference-rewriter';

/**
 * How many tickets a conversion would change: those whose reference is not the one their number
 * has in the workspace's current format. Zero means converting would do nothing.
 */
export class CountTicketsToConvert {
  constructor(
    private readonly referenceRepository: WorkspaceTicketReferenceRepository,
    private readonly rewriter: TicketReferenceRewriter,
  ) {}

  async execute(props: { workspaceId: string }): Promise<number> {
    const format = ticketReferenceFormatOf(await this.referenceRepository.findByWorkspaceId(props.workspaceId));
    return this.rewriter.countDiffering(props.workspaceId, format);
  }
}
