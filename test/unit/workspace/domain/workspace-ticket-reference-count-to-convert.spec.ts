import { CountTicketsToConvert } from '../../../../src/workspace/domain/services/workspace-ticket-reference-count-to-convert';
import { TicketReferenceRewriter } from '../../../../src/workspace/domain/ticket-reference-rewriter';
import { WorkspaceTicketReference } from '../../../../src/workspace/domain/entities/workspace-ticket-reference';
import { WorkspaceTicketReferenceRepository } from '../../../../src/workspace/domain/repositories/workspace-ticket-reference.repository';
import { TicketReferenceFormat, formatTicketReference } from '../../../../src/ticket/domain/ticket-reference';

class InMemoryReferences implements WorkspaceTicketReferenceRepository {
  rows = new Map<string, WorkspaceTicketReference>();
  async findByWorkspaceId(workspaceId: string) { return this.rows.get(workspaceId) ?? null; }
  async save(reference: WorkspaceTicketReference) { this.rows.set(reference.workspaceId, reference); }
}

/** Tickets of one workspace as number and stored reference, compared the way the SQL one does. */
class InMemoryTickets implements TicketReferenceRewriter {
  constructor(private readonly tickets: { number: number; reference: string | null }[]) {}
  async rewriteAll() { return this.tickets.length; }
  async countDiffering(_workspaceId: string, format: TicketReferenceFormat) {
    return this.tickets.filter((t) => t.reference !== formatTicketReference(t.number, format)).length;
  }
}

describe('CountTicketsToConvert', () => {
  let references: InMemoryReferences;

  beforeEach(() => {
    references = new InMemoryReferences();
  });

  it('finds nothing to convert when every ticket already has its reference in the current format', async () => {
    // A new workspace: sequential with the default prefix, never changed
    const tickets = new InMemoryTickets([{ number: 1, reference: 'TK-000001' }, { number: 2, reference: 'TK-000002' }]);
    expect(await new CountTicketsToConvert(references, tickets).execute({ workspaceId: 'ws-1' })).toBe(0);
  });

  it('counts the tickets left in an earlier format after it changed', async () => {
    references.rows.set('ws-1', new WorkspaceTicketReference({ workspaceId: 'ws-1', style: 'sequential', prefix: 'ACME', secret: null }));
    const tickets = new InMemoryTickets([
      { number: 1, reference: 'TK-000001' },
      { number: 2, reference: 'TK-000002' },
      { number: 3, reference: 'ACME-000003' },
    ]);
    expect(await new CountTicketsToConvert(references, tickets).execute({ workspaceId: 'ws-1' })).toBe(2);
  });
});
