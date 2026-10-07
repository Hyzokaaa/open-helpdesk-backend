import { WorkspaceTicketReferenceRepository } from '../../../workspace/domain/repositories/workspace-ticket-reference.repository';
import {
  DEFAULT_TICKET_REFERENCE_FORMAT,
  TicketReferenceFormat,
  parseTicketReference,
  ticketReferenceFormatOf,
} from '../ticket-reference';

/**
 * Reads search terms as ticket references of each workspace's own format, looking the format up
 * once per workspace for the life of the instance (one request, one command). Shown references
 * are not computed here: each ticket keeps the one it was created with.
 */
export class TicketReferenceFormats {
  private readonly cache = new Map<string, Promise<TicketReferenceFormat>>();

  constructor(private readonly repository: WorkspaceTicketReferenceRepository) {}

  forWorkspace(workspaceId: string): Promise<TicketReferenceFormat> {
    let format = this.cache.get(workspaceId);
    if (!format) {
      format = this.repository
        .findByWorkspaceId(workspaceId)
        .then((settings) => ticketReferenceFormatOf(settings))
        .catch(() => DEFAULT_TICKET_REFERENCE_FORMAT);
      this.cache.set(workspaceId, format);
    }
    return format;
  }

  /** The ways a term can be spelled as a stored reference: as typed, and with the workspace prefix. */
  async candidates(workspaceId: string, term: string): Promise<string[]> {
    const typed = term.trim().toUpperCase();
    if (!typed) return [];
    const { prefix } = await this.forWorkspace(workspaceId);
    return typed.startsWith(`${prefix}-`) ? [typed] : [typed, `${prefix}-${typed}`];
  }

  async parse(workspaceId: string, term: string): Promise<number | null> {
    return parseTicketReference(term, await this.forWorkspace(workspaceId));
  }
}
