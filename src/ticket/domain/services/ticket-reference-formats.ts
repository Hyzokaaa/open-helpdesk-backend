import { WorkspaceTicketReferenceRepository } from '../../../workspace/domain/repositories/workspace-ticket-reference.repository';
import {
  DEFAULT_TICKET_REFERENCE_FORMAT,
  TicketReferenceFormat,
  formatTicketReference,
  parseTicketReference,
  ticketReferenceFormatOf,
} from '../ticket-reference';

/**
 * Formats and reads ticket references with each workspace's own format, looking the format up
 * once per workspace for the life of the instance (one request, one command).
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

  async format(workspaceId: string, ticketNumber: number): Promise<string> {
    return formatTicketReference(ticketNumber, await this.forWorkspace(workspaceId));
  }

  async parse(workspaceId: string, term: string): Promise<number | null> {
    return parseTicketReference(term, await this.forWorkspace(workspaceId));
  }
}
