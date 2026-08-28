import { PickupTicket } from '../../../../src/ticket/domain/services/ticket-pickup';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';

import { DomainValidationError } from '../../../../src/shared/domain/errors';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';

function makeTicket(overrides: Partial<{ status: TicketStatus; assigneeId: string | null }> = {}) {
  return new Ticket({
    id: 'ticket-1',
    name: 'Test',
    description: '',
    priority: TicketPriority.MEDIUM,
    status: overrides.status ?? TicketStatus.OPEN,
    categoryId: 'cat-issue',
    workspaceId: 'ws-1',
    reporterId: 'creator-1',
    assigneeId: overrides.assigneeId ?? null,
    ticketNumber: 1,
    tagIds: [],
    customFields: {},
    discardReason: null,
    portalToken: null,
    firstResponseAt: null,
    resolvedAt: null,
    resolvedById: null,
    firstResponseBreached: false,
    resolutionBreached: false,
    createdAt: null,
    deletedAt: null,
  });
}

describe('PickupTicket', () => {
  let repository: MockTicketRepository;
  let service: PickupTicket;

  beforeEach(() => {
    repository = new MockTicketRepository();
    service = new PickupTicket(repository);
  });

  it('should assign the user and set status to pending', async () => {
    await repository.create(makeTicket());

    const result = await service.execute({ ticketId: 'ticket-1', userId: 'agent-1' });

    expect(result.assigneeId).toBe('agent-1');
    expect(result.status).toBe(TicketStatus.PENDING);
  });

  it('should throw if ticket is not open', async () => {
    await repository.create(makeTicket({ status: TicketStatus.PENDING }));

    await expect(
      service.execute({ ticketId: 'ticket-1', userId: 'agent-1' }),
    ).rejects.toThrow(DomainValidationError);
  });
});
