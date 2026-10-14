import { FindRepliedTicket } from '../../../src/email-inbound/domain/services/inbound-email-find-ticket';
import { extractThreadIds } from '../../../src/email/domain/ticket-email-thread';
import { Comment } from '../../../src/comment/domain/entities/comment';
import { TicketParticipant } from '../../../src/ticket/domain/entities/ticket-participant';
import { ParticipantRole } from '../../../src/ticket/domain/enums/participant-role.enum';
import { MockTicketRepository } from '../../mocks/mock-ticket.repository';
import { MockCommentRepository } from '../../mocks/mock-comment.repository';
import { MockTicketParticipantRepository } from '../../mocks/mock-ticket-participant.repository';
import { makeTicket } from '../ticket/application/ticket-security-fixtures';

describe('extractThreadIds', () => {
  it('reads ticket and comment ids from In-Reply-To and References, closest first', () => {
    const ids = extractThreadIds(
      '<comment-C2@help.x.com>',
      '<ticket-T1@help.x.com> <confirmation-T1@help.x.com> <comment-C1@help.x.com> <comment-C2@help.x.com>',
    );
    expect(ids.ticketIds).toEqual(['T1']);
    expect(ids.commentIds).toEqual(['C2', 'C1']);
  });

  it('accepts References as a list and ignores unrelated ids', () => {
    expect(extractThreadIds(undefined, ['<abc@gmail.com>', '<ticket-T9@x.com>'])).toEqual({ ticketIds: ['T9'], commentIds: [] });
    expect(extractThreadIds(null, '<f7a3-aefe@local.test>')).toEqual({ ticketIds: [], commentIds: [] });
  });
});

describe('FindRepliedTicket', () => {
  let tickets: MockTicketRepository;
  let comments: MockCommentRepository;
  let participants: MockTicketParticipantRepository;
  const none = { ticketIds: [], commentIds: [] };

  beforeEach(async () => {
    tickets = new MockTicketRepository();
    comments = new MockCommentRepository();
    participants = new MockTicketParticipantRepository();
    const ticket = makeTicket({ id: 'T1', workspaceId: 'ws-1', reporterId: 'carla' });
    ticket.reference = 'TK-000003';
    await tickets.create(ticket);
    await tickets.create(makeTicket({ id: 'T-OTHER-WS', workspaceId: 'ws-2' }));
    await comments.create(new Comment({ id: 'C1', content: 'hi', ticketId: 'T1', authorId: 'agent' }));
    participants.seed(new TicketParticipant({ id: 'p1', ticketId: 'T1', userId: 'colega', role: ParticipantRole.FOLLOWER }));
  });

  const find = (props: Partial<Parameters<FindRepliedTicket['execute']>[0]>) =>
    new FindRepliedTicket(tickets, comments, participants).execute({
      thread: none, subject: 'Hola', workspaceId: 'ws-1', senderId: 'carla', ...props,
    });

  it('finds the ticket from its id in the thread', async () => {
    expect((await find({ thread: { ticketIds: ['T1'], commentIds: [] } }))?.getId()).toBe('T1');
  });

  it('finds the ticket of a comment that was answered', async () => {
    expect((await find({ thread: { ticketIds: [], commentIds: ['C1'] } }))?.getId()).toBe('T1');
  });

  it('ignores a ticket of another workspace', async () => {
    expect(await find({ thread: { ticketIds: ['T-OTHER-WS'], commentIds: [] } })).toBeNull();
  });

  it('falls back to the reference in the subject for someone taking part in the ticket', async () => {
    expect((await find({ subject: 'RE: La impresora — tk-000003' }))?.getId()).toBe('T1');
    expect((await find({ subject: 'Re: impresora TK-000003', senderId: 'colega' }))?.getId()).toBe('T1');
  });

  it('does not add to a ticket whose reference a stranger writes in a subject', async () => {
    expect(await find({ subject: 'Sobre TK-000003', senderId: 'stranger' })).toBeNull();
  });

  it('starts a new conversation when nothing points to a ticket', async () => {
    expect(await find({ subject: 'Nueva consulta' })).toBeNull();
  });
});
