import { AssignTicket } from '../../../../src/ticket/domain/services/ticket-assign';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../../src/ticket/domain/enums/ticket-category.enum';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('AssignTicket', () => {
  let service: AssignTicket;
  let repository: MockTicketRepository;

  beforeEach(() => {
    repository = new MockTicketRepository();
    service = new AssignTicket(repository);

    repository.create(new Ticket({
      id: 'ticket-1', name: 'T', description: '', priority: TicketPriority.LOW,
      status: TicketStatus.PENDING, category: TicketCategory.BUG, workspaceId: 'ws-1',
      creatorId: 'u-1', assigneeId: null, resolvedAt: null, createdAt: new Date(), deletedAt: null, tagIds: [],
    }));
  });

  it('should assign a user to the ticket', async () => {
    const result = await service.execute({ ticketId: 'ticket-1', assigneeId: 'agent-1' });
    expect(result.assigneeId).toBe('agent-1');
  });

  it('should allow unassigning (null)', async () => {
    await service.execute({ ticketId: 'ticket-1', assigneeId: 'agent-1' });
    const result = await service.execute({ ticketId: 'ticket-1', assigneeId: null });
    expect(result.assigneeId).toBeNull();
  });

  it('should throw EntityNotFoundError when ticket does not exist', async () => {
    await expect(service.execute({ ticketId: 'nope', assigneeId: 'x' })).rejects.toThrow(EntityNotFoundError);
  });
});
