import { GetTicketQuery } from '../../../../src/ticket/application/queries/get-ticket.query';
import { ListTicketCommentsQuery } from '../../../../src/comment/application/queries/list-ticket-comments.query';
import { Comment } from '../../../../src/comment/domain/entities/comment';
import { SummarizeUsers } from '../../../../src/user/domain/services/user-summarize';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { MockCommentRepository } from '../../../mocks/mock-comment.repository';
import { TicketWorld, WS_A, makeTicket, makeUser } from './ticket-security-fixtures';

// A customer (USER role) cannot list the workspace members, so the ticket and its
// comments carry the names of the people involved — and nothing else about them.
describe('People named on a ticket', () => {
  let world: TicketWorld;
  let comments: MockCommentRepository;
  const customer = { userId: 'customer', workspaceId: WS_A, isSystemAdmin: false };

  beforeEach(async () => {
    world = new TicketWorld();
    comments = new MockCommentRepository();
    world.member('customer', WorkspaceRole.USER);
    world.member('agent', WorkspaceRole.AGENT);
    world.users.seed(makeUser('left-the-workspace'));
    await world.tickets.create(makeTicket({ reporterId: 'customer', assigneeId: 'agent' }));
    await comments.create(new Comment({ id: 'c-1', content: 'hi', ticketId: 'ticket-a', authorId: 'agent' }));
    await comments.create(new Comment({ id: 'c-2', content: 'old', ticketId: 'ticket-a', authorId: 'left-the-workspace' }));
    await comments.create(new Comment({ id: 'c-3', content: 'ghost', ticketId: 'ticket-a', authorId: 'deleted-user' }));
  });

  it('names the reporter and the assignee of the ticket for its customer', async () => {
    const query = new GetTicketQuery(world.tickets, world.ensureTicketAccess(), new SummarizeUsers(world.users));
    const ticket = await query.execute({ ticketId: 'ticket-a', ...customer });

    expect(ticket.reporter).toEqual({ id: 'customer', firstName: 'customer', lastName: 'Test' });
    expect(ticket.assignee).toEqual({ id: 'agent', firstName: 'agent', lastName: 'Test' });
    expect(ticket.registeredBy).toBeNull();
    expect(ticket.resolvedBy).toBeNull();
    expect(ticket.reporterId).toBe('customer');
    expect(JSON.stringify(ticket)).not.toContain('@example.com');
  });

  it('names every comment author, including people no longer in the workspace', async () => {
    const query = new ListTicketCommentsQuery(comments, world.ensureTicketAccess(), new SummarizeUsers(world.users));
    const page = await query.execute({ ticketId: 'ticket-a', ...customer, page: 1, limit: 20 });
    const authors = Object.fromEntries(page.items.map((c) => [c.id, c.author]));

    expect(authors['c-1']).toEqual({ id: 'agent', firstName: 'agent', lastName: 'Test' });
    expect(authors['c-2']).toEqual({ id: 'left-the-workspace', firstName: 'left-the-workspace', lastName: 'Test' });
    expect(authors['c-3']).toBeNull();
    expect(JSON.stringify(page)).not.toContain('@example.com');
  });

  it('keeps the previous response shape when no name lookup is wired', async () => {
    const ticket = await new GetTicketQuery(world.tickets, world.ensureTicketAccess()).execute({ ticketId: 'ticket-a', ...customer });
    expect(ticket).not.toHaveProperty('reporter');
  });
});
