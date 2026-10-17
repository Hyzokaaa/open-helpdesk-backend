import { KeepEmailQuote } from '../../../../src/ticket/domain/services/email-quote-keep';
import { MockEmailQuoteRepository } from '../../../mocks/mock-email-quote.repository';
import { EnsureTicketPortalAccess } from '../../../../src/ticket/domain/services/ticket-portal-access-ensure';
import { MockTicketPortalAccessRepository } from '../../../mocks/mock-ticket-portal-access.repository';
import { RouteInboundEmail } from '../../../../src/email-inbound/domain/services/route-inbound-email';
import { ParsedInboundEmail } from '../../../../src/email-inbound/infrastructure/imap/imap-email-parser';
import { CreateUser } from '../../../../src/user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../../src/workspace/domain/services/workspace-add-member';
import { CreateTicket } from '../../../../src/ticket/domain/services/ticket-create';
import { CreateComment } from '../../../../src/comment/domain/services/comment-create';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';

import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { User } from '../../../../src/user/domain/entities/user';
import { Mailbox } from '../../../../src/mailbox/domain/entities/mailbox';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { EventPublisher } from '../../../../src/shared/domain/event-publisher';
import { MailboxRepository } from '../../../../src/mailbox/domain/repositories/mailbox.repository';
import { MailboxType } from '../../../../src/mailbox/domain/enums/mailbox-type.enum';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockCommentRepository } from '../../../mocks/mock-comment.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakePasswordHasher } from '../../../mocks/fake-password-hasher';

class MockMailboxRepository implements MailboxRepository {
  private mailboxes: Mailbox[] = [];

  async create(mailbox: Mailbox): Promise<void> { this.mailboxes.push(mailbox); }
  async findById(id: string): Promise<Mailbox | null> { return this.mailboxes.find((m) => m.getId() === id) ?? null; }
  async findByAddress(address: string): Promise<Mailbox | null> { return this.mailboxes.find((m) => m.address === address) ?? null; }
  async findByWorkspaceId(workspaceId: string): Promise<Mailbox | null> { return this.mailboxes.find((m) => m.workspaceId === workspaceId) ?? null; }
  async findAllByWorkspaceId(workspaceId: string): Promise<Mailbox[]> { return this.mailboxes.filter((m) => m.workspaceId === workspaceId); }
  async findAllByType(type: MailboxType): Promise<Mailbox[]> { return this.mailboxes.filter((m) => m.type === type); }
  async update(mailbox: Mailbox): Promise<void> { const i = this.mailboxes.findIndex((m) => m.getId() === mailbox.getId()); if (i >= 0) this.mailboxes[i] = mailbox; }
  async delete(id: string): Promise<void> { this.mailboxes = this.mailboxes.filter((m) => m.getId() !== id); }
  async findSystemMailbox(): Promise<Mailbox | null> { return this.mailboxes.find((m) => m.workspaceId === null) ?? null; }

  seed(mailbox: Mailbox): void { this.mailboxes.push(mailbox); }
}

class FakeEventPublisher implements EventPublisher {
  events: { event: string; data: unknown }[] = [];
  emit(event: string, data: unknown): void { this.events.push({ event, data }); }
}

function baseParsedEmail(overrides: Partial<ParsedInboundEmail> = {}): ParsedInboundEmail {
  return {
    fromAddress: 'sender@external.com',
    toAddresses: ['support@company.com'],
    subject: 'Need help',
    body: 'I have a problem',
    thread: { ticketIds: [], commentIds: [] },
    attachments: [],
    ...overrides,
  };
}

describe('RouteInboundEmail', () => {
  let quotes: MockEmailQuoteRepository;
  let service: RouteInboundEmail;
  let mailboxRepository: MockMailboxRepository;
  let userRepository: MockUserRepository;
  let memberRepository: MockWorkspaceMemberRepository;
  let workspaceRepository: MockWorkspaceRepository;
  let ticketRepository: MockTicketRepository;
  let commentRepository: MockCommentRepository;
  let eventPublisher: FakeEventPublisher;
  let idGenerator: FakeIdGenerator;

  beforeEach(() => {
    mailboxRepository = new MockMailboxRepository();
    userRepository = new MockUserRepository();
    memberRepository = new MockWorkspaceMemberRepository();
    workspaceRepository = new MockWorkspaceRepository();
    ticketRepository = new MockTicketRepository();
    commentRepository = new MockCommentRepository();
    eventPublisher = new FakeEventPublisher();
    idGenerator = new FakeIdGenerator();

    const passwordHasher = new FakePasswordHasher();
    const createUser = new CreateUser(idGenerator, userRepository, passwordHasher);
    const addMember = new AddWorkspaceMember(idGenerator, memberRepository);
    const createTicket = new CreateTicket(idGenerator, ticketRepository, new EnsureTicketPortalAccess(idGenerator, new MockTicketPortalAccessRepository()));
    const createComment = new CreateComment(idGenerator, commentRepository);
    quotes = new MockEmailQuoteRepository();

    service = new RouteInboundEmail(
      mailboxRepository,
      userRepository,
      memberRepository,
      workspaceRepository,
      ticketRepository,
      createUser,
      addMember,
      createTicket,
      createComment,
      eventPublisher,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      new KeepEmailQuote(idGenerator, quotes),
    );

    // Seed a mailbox and workspace
    mailboxRepository.seed(new Mailbox({
      id: 'mb-1',
      address: 'support@company.com',
      workspaceId: 'ws-1',
      isActive: true,
    }));

    workspaceRepository.seed(new Workspace({
      id: 'ws-1',
      name: 'Main',
      slug: 'main',
      description: 'Main workspace',
    }));
  });

  it('should create a new ticket from a new email', async () => {
    const result = await service.execute(baseParsedEmail());

    expect(result.action).toBe('ticket-created');
    expect(result.ticketId).toBeDefined();

    const tickets = ticketRepository.getAll();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].name).toBe('Need help');
  });

  it('should add a comment to existing ticket when In-Reply-To matches', async () => {
    // Seed an existing user and ticket
    const existingUser = new User({
      id: 'u-existing',
      email: 'sender@external.com',
      password: 'hashed:pass',
      firstName: 'Sender',
      lastName: 'User',
      isActive: true,
      isSystemAdmin: false,
      isEmailVerified: true,
      language: 'en',
      theme: 'system',
    });
    userRepository.seed(existingUser);
    memberRepository.seed(new WorkspaceMember({
      id: 'wm-1',
      workspaceId: 'ws-1',
      userId: 'u-existing',
      role: WorkspaceRole.USER,
    }));

    const existingTicket = new Ticket({
      id: 'ticket-abc',
      name: 'Original ticket',
      description: 'desc',
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      categoryId: 'cat-issue',
      workspaceId: 'ws-1',
      reporterId: 'u-existing',
      assigneeId: null,
      resolvedAt: null,
      resolvedById: null,
      createdAt: new Date(),
      deletedAt: null,
      tagIds: [],
      customFields: {},
      discardReason: null,
    });
    ticketRepository.create(existingTicket);

    const result = await service.execute(baseParsedEmail({
      thread: { ticketIds: ['ticket-abc'], commentIds: [] },
      body: 'Thanks for looking into this',
    }));

    expect(result.action).toBe('comment-added');
    expect(result.ticketId).toBe('ticket-abc');

    const comments = commentRepository.getAll();
    expect(comments).toHaveLength(1);
    expect(comments[0].ticketId).toBe('ticket-abc');
  });

  it('keeps what the sender wrote as the comment and folds the quote under it', async () => {
    const created = await service.execute(baseParsedEmail());
    const reply = await service.execute(baseParsedEmail({
      thread: { ticketIds: [created.ticketId!], commentIds: [] },
      body: 'Ya funciona, gracias.\n\nOn Tue, 14 Oct 2026 at 12:35, Support <support@company.com> wrote:\n> We restarted the printer.',
    }));

    expect(reply.action).toBe('comment-added');
    const [comment] = commentRepository.getAll();
    expect(comment.content).toContain('Ya funciona, gracias.');
    expect(comment.content).not.toContain('restarted');
    const quote = await quotes.findByTicketAndComment(created.ticketId!, comment.getId());
    expect(quote).toMatchObject({ method: 'text' });
    expect(quote!.content).toContain('We restarted the printer.');
  });

  it('takes the email that opens a ticket whole, a forward included, and folds only its signature', async () => {
    const result = await service.execute(baseParsedEmail({
      body: 'Mira abajo.\n\n---------- Forwarded message ---------\nFrom: Proveedor <p@prov.com>\nDate: Tue, 14 Oct 2026\nSubject: Factura\nTo: cliente@external.com\n\nLa factura vence mañana.\n-- \nAna Pérez',
    }));

    const [ticket] = ticketRepository.getAll();
    expect(ticket.description).toContain('La factura vence mañana.');
    expect(ticket.description).not.toContain('Ana Pérez');
    const quote = await quotes.findByTicketAndComment(result.ticketId!, null);
    expect(quote!.content).toContain('Ana Pérez');
  });

  it('should auto-create a user when email is from unknown address', async () => {
    const result = await service.execute(baseParsedEmail({
      fromAddress: 'newperson@external.com',
    }));

    expect(result.action).toBe('ticket-created');

    const users = await userRepository.findAll();
    const created = users.find((u) => u.email === 'newperson@external.com');
    expect(created).toBeDefined();
    expect(created!.autoCreated).toBe(true);
    expect(created!.firstName).toBe('newperson');
  });

  it('should reject email sent to unknown mailbox address', async () => {
    const result = await service.execute(baseParsedEmail({
      toAddresses: ['unknown@other.com'],
    }));

    expect(result.action).toBe('rejected');
    expect(result.reason).toBe('unknown-mailbox');
  });

  it('should add sender as USER member to workspace if not already a member', async () => {
    await service.execute(baseParsedEmail({ fromAddress: 'newguy@ext.com' }));

    const members = await memberRepository.findByWorkspaceId('ws-1');
    const newMember = members.find((m) => {
      // Find the user first to get ID
      return m.role === WorkspaceRole.USER;
    });
    expect(newMember).toBeDefined();
    expect(newMember!.role).toBe(WorkspaceRole.USER);
  });

  it('should emit ticket.created event when creating a new ticket', async () => {
    await service.execute(baseParsedEmail());

    const ticketEvents = eventPublisher.events.filter((e) => e.event === 'ticket.created');
    expect(ticketEvents).toHaveLength(1);
  });

  it('should emit comment.created event when adding a comment to existing ticket', async () => {
    userRepository.seed(new User({
      id: 'u-existing',
      email: 'sender@external.com',
      password: 'hashed:pass',
      firstName: 'Sender',
      lastName: 'User',
      isActive: true,
      isSystemAdmin: false,
      isEmailVerified: true,
      language: 'en',
      theme: 'system',
    }));
    memberRepository.seed(new WorkspaceMember({
      id: 'wm-1',
      workspaceId: 'ws-1',
      userId: 'u-existing',
      role: WorkspaceRole.USER,
    }));
    ticketRepository.create(new Ticket({
      id: 'ticket-abc',
      name: 'Original',
      description: 'desc',
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      categoryId: 'cat-issue',
      workspaceId: 'ws-1',
      reporterId: 'u-existing',
      assigneeId: null,
      resolvedAt: null,
      resolvedById: null,
      createdAt: new Date(),
      deletedAt: null,
      tagIds: [],
      customFields: {},
      discardReason: null,
    }));

    await service.execute(baseParsedEmail({ thread: { ticketIds: ['ticket-abc'], commentIds: [] } }));

    const commentEvents = eventPublisher.events.filter((e) => e.event === 'comment.created');
    expect(commentEvents).toHaveLength(1);
  });
});
