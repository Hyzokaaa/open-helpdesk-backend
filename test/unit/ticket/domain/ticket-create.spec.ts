import { CreateTicket } from '../../../../src/ticket/domain/services/ticket-create';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../../src/ticket/domain/enums/ticket-category.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';

describe('CreateTicket', () => {
  let service: CreateTicket;
  let repository: MockTicketRepository;
  let idGenerator: FakeIdGenerator;

  beforeEach(() => {
    repository = new MockTicketRepository();
    idGenerator = new FakeIdGenerator();
    service = new CreateTicket(idGenerator, repository);
  });

  it('should create a ticket with pending status', async () => {
    const ticket = await service.execute({
      name: 'Test ticket',
      description: 'A description',
      priority: TicketPriority.HIGH,
      category: TicketCategory.BUG,
      workspaceId: 'ws-1',
      creatorId: 'user-1',
      tagIds: ['tag-1'],
    });

    expect(ticket.name).toBe('Test ticket');
    expect(ticket.status).toBe(TicketStatus.PENDING);
    expect(ticket.priority).toBe(TicketPriority.HIGH);
    expect(ticket.workspaceId).toBe('ws-1');
    expect(ticket.creatorId).toBe('user-1');
    expect(ticket.assigneeId).toBeNull();
    expect(ticket.tagIds).toEqual(['tag-1']);
  });

  it('should persist the ticket in the repository', async () => {
    await service.execute({
      name: 'Persisted',
      description: 'desc',
      priority: TicketPriority.LOW,
      category: TicketCategory.ISSUE,
      workspaceId: 'ws-1',
      creatorId: 'user-1',
      tagIds: [],
    });

    const all = repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Persisted');
  });
});
