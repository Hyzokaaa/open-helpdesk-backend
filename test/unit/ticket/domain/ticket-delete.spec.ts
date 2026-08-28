import { DeleteTicket } from '../../../../src/ticket/domain/services/ticket-delete';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';

import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('DeleteTicket', () => {
  let service: DeleteTicket;
  let repository: MockTicketRepository;

  beforeEach(() => {
    repository = new MockTicketRepository();
    service = new DeleteTicket(repository);
  });

  it('should soft delete an existing ticket', async () => {
    await repository.create(new Ticket({
      id: 'ticket-1', name: 'T', description: '', priority: TicketPriority.LOW,
      status: TicketStatus.PENDING, categoryId: 'cat-bug', workspaceId: 'ws-1',
      reporterId: 'u-1', assigneeId: null, resolvedAt: null, resolvedById: null, createdAt: new Date(), deletedAt: null, tagIds: [],
      customFields: {}, discardReason: null,
    }));

    await service.execute({ ticketId: 'ticket-1' });

    expect(await repository.findById('ticket-1')).toBeNull();
  });

  it('should throw EntityNotFoundError when ticket does not exist', async () => {
    await expect(service.execute({ ticketId: 'nope' })).rejects.toThrow(EntityNotFoundError);
  });
});
