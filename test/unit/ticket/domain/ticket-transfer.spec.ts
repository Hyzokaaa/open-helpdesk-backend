import { TransferTicket } from '../../../../src/ticket/domain/services/ticket-transfer';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../../src/ticket/domain/enums/ticket-category.enum';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';

function makeTicket(overrides: Partial<{ assigneeId: string | null; creatorId: string }> = {}) {
  return new Ticket({
    id: 'ticket-1',
    name: 'Test',
    description: '',
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.IN_PROGRESS,
    category: TicketCategory.ISSUE,
    workspaceId: 'ws-1',
    creatorId: overrides.creatorId ?? 'creator-1',
    assigneeId: overrides.assigneeId ?? 'agent-1',
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

describe('TransferTicket', () => {
  let repository: MockTicketRepository;
  let service: TransferTicket;

  beforeEach(() => {
    repository = new MockTicketRepository();
    service = new TransferTicket(repository);
  });

  it('should transfer when user is the assignee', async () => {
    await repository.create(makeTicket({ assigneeId: 'agent-1' }));

    const result = await service.execute({ ticketId: 'ticket-1', fromUserId: 'agent-1', toUserId: 'agent-2' });

    expect(result.assigneeId).toBe('agent-2');
  });

  it('should transfer when user is the creator', async () => {
    await repository.create(makeTicket({ assigneeId: 'agent-1', creatorId: 'creator-1' }));

    const result = await service.execute({ ticketId: 'ticket-1', fromUserId: 'creator-1', toUserId: 'agent-3' });

    expect(result.assigneeId).toBe('agent-3');
  });

  it('should throw if user is neither assignee nor creator', async () => {
    await repository.create(makeTicket({ assigneeId: 'agent-1', creatorId: 'creator-1' }));

    await expect(
      service.execute({ ticketId: 'ticket-1', fromUserId: 'random-user', toUserId: 'agent-2' }),
    ).rejects.toThrow(AccessDeniedError);
  });
});
