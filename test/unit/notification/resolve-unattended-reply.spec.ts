import { ResolveUnattendedReplyRecipients } from '../../../src/notification/domain/services/notification-resolve-unattended-reply';
import { TicketParticipant } from '../../../src/ticket/domain/entities/ticket-participant';
import { ParticipantRole } from '../../../src/ticket/domain/enums/participant-role.enum';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { MockTicketRepository } from '../../mocks/mock-ticket.repository';
import { MockTicketParticipantRepository } from '../../mocks/mock-ticket-participant.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { makeMember, makeTicket, makeUser, WS_A } from '../ticket/application/ticket-security-fixtures';

// Carla (customer) reports T1; Ana (admin) and Sara (supervisor) run the workspace; Pepe is an agent.
describe('ResolveUnattendedReplyRecipients', () => {
  let tickets: MockTicketRepository;
  let participants: MockTicketParticipantRepository;
  let members: MockWorkspaceMemberRepository;
  let users: MockUserRepository;

  beforeEach(async () => {
    tickets = new MockTicketRepository();
    participants = new MockTicketParticipantRepository();
    members = new MockWorkspaceMemberRepository();
    users = new MockUserRepository();
    for (const id of ['carla', 'colega', 'ana', 'sara', 'pepe']) users.seed(makeUser(id));
    members.seed(makeMember('carla', WorkspaceRole.USER));
    members.seed(makeMember('colega', WorkspaceRole.USER));
    members.seed(makeMember('ana', WorkspaceRole.ADMIN));
    members.seed(makeMember('sara', WorkspaceRole.SUPERVISOR));
    members.seed(makeMember('pepe', WorkspaceRole.AGENT));
    await tickets.create(makeTicket({ id: 'T1', reporterId: 'carla' }));
  });

  const resolve = (authorId: string) =>
    new ResolveUnattendedReplyRecipients(tickets, participants, members, users)
      .execute({ ticketId: 'T1', workspaceId: WS_A, authorId })
      .then((list) => list.map((u) => u.getId()).sort());
  const follow = (userId: string) =>
    participants.seed(new TicketParticipant({ id: `p-${userId}`, ticketId: 'T1', userId, role: ParticipantRole.FOLLOWER }));

  it('alerts admins and supervisors when a customer answers a ticket nobody on the team looks after', async () => {
    expect(await resolve('carla')).toEqual(['ana', 'sara']);
  });

  it('also when the follower who answers is a customer', async () => {
    follow('colega');
    expect(await resolve('colega')).toEqual(['ana', 'sara']);
  });

  it('stays quiet when someone on the team follows the ticket', async () => {
    follow('pepe');
    expect(await resolve('carla')).toEqual([]);
  });

  it('stays quiet when the ticket has an owner', async () => {
    const ticket = (await tickets.findById('T1'))!;
    ticket.assigneeId = 'pepe';
    expect(await resolve('carla')).toEqual([]);
  });

  it('stays quiet when the author is on the team', async () => {
    expect(await resolve('pepe')).toEqual([]);
  });
});
