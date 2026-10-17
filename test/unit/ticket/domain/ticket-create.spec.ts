import { CreateTicket } from '../../../../src/ticket/domain/services/ticket-create';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';

import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockTicketPortalAccessRepository } from '../../../mocks/mock-ticket-portal-access.repository';
import { EnsureTicketPortalAccess } from '../../../../src/ticket/domain/services/ticket-portal-access-ensure';

describe('CreateTicket', () => {
  let service: CreateTicket;
  let repository: MockTicketRepository;
  let idGenerator: FakeIdGenerator;
  let accesses: MockTicketPortalAccessRepository;

  beforeEach(() => {
    repository = new MockTicketRepository();
    idGenerator = new FakeIdGenerator();
    accesses = new MockTicketPortalAccessRepository();
    service = new CreateTicket(idGenerator, repository, new EnsureTicketPortalAccess(idGenerator, accesses));
  });

  it('should create a ticket with open status', async () => {
    const { ticket } = await service.execute({
      name: 'Test ticket',
      description: 'A description',
      priority: TicketPriority.HIGH,
      categoryId: 'cat-bug',
      workspaceId: 'ws-1',
      reporterId: 'user-1',
      tagIds: ['tag-1'],
    });

    expect(ticket.name).toBe('Test ticket');
    expect(ticket.status).toBe(TicketStatus.OPEN);
    expect(ticket.priority).toBe(TicketPriority.HIGH);
    expect(ticket.workspaceId).toBe('ws-1');
    expect(ticket.reporterId).toBe('user-1');
    expect(ticket.assigneeId).toBeNull();
    expect(ticket.tagIds).toEqual(['tag-1']);
  });

  it('should persist the ticket in the repository', async () => {
    await service.execute({
      name: 'Persisted',
      description: 'desc',
      priority: TicketPriority.LOW,
      categoryId: 'cat-issue',
      workspaceId: 'ws-1',
      reporterId: 'user-1',
      tagIds: [],
    });

    const all = repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Persisted');
  });

  it('gives the reporter a portal link to the new ticket, whatever way it came in', async () => {
    const { ticket, reporterAccess } = await service.execute({
      name: 'Opened for a customer',
      description: '',
      priority: TicketPriority.MEDIUM,
      categoryId: 'cat-issue',
      workspaceId: 'ws-1',
      reporterId: 'customer-1',
      tagIds: [],
    });

    expect(reporterAccess.ticketId).toBe(ticket.getId());
    expect(reporterAccess.userId).toBe('customer-1');
    expect(reporterAccess.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(accesses.all()).toEqual([reporterAccess]);
  });
});
