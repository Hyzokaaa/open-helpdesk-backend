import { CreateComment } from '../../../../src/comment/domain/services/comment-create';
import { CreateCommentCommand } from '../../../../src/comment/application/commands/create-comment.command';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { AddTicketParticipant } from '../../../../src/ticket/domain/services/ticket-add-participant';
import { FollowTicket } from '../../../../src/ticket/domain/services/ticket-follow';
import { EnsureTicketAccess } from '../../../../src/ticket/domain/services/ticket-ensure-access';
import { User } from '../../../../src/user/domain/entities/user';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { MockCommentRepository } from '../../../mocks/mock-comment.repository';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockTicketParticipantRepository } from '../../../mocks/mock-ticket-participant.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { makeTicket } from '../../ticket/application/ticket-security-fixtures';

const user = (id: string, firstName: string) => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName, lastName: 'Test',
  isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
});

// An unassigned ticket of Carla; an admin answers it.
describe('Commenting on a ticket follows it', () => {
  let tickets: MockTicketRepository;
  let participants: MockTicketParticipantRepository;
  let members: MockWorkspaceMemberRepository;
  let workspaces: MockWorkspaceRepository;
  let users: MockUserRepository;
  let audit: MockAuditLogRepository;

  beforeEach(async () => {
    tickets = new MockTicketRepository();
    participants = new MockTicketParticipantRepository();
    members = new MockWorkspaceMemberRepository();
    workspaces = new MockWorkspaceRepository();
    users = new MockUserRepository();
    audit = new MockAuditLogRepository();
    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'carla', role: WorkspaceRole.USER }));
    users.seed(user('admin', 'Admin'));
    users.seed(user('carla', 'Carla'));
    users.seed(user('sara', 'Sara'));
    await tickets.create(makeTicket({ id: 'T1', workspaceId: 'ws-1', reporterId: 'carla' }));
  });

  const comment = (authorId: string, content = 'hello') => {
    const auditLog = new CreateAuditLogEntry(new FakeIdGenerator(), audit);
    return new CreateCommentCommand(
      new CreateComment(new FakeIdGenerator(), new MockCommentRepository()),
      new EnsureTicketAccess(tickets, new EnsureWorkspacePermission(members), participants),
      tickets,
      workspaces,
      users,
      { emit: jest.fn() },
      auditLog,
      new FollowTicket(new AddTicketParticipant(new FakeIdGenerator(), participants), auditLog, users),
    ).execute({ content, ticketId: 'T1', authorId, workspaceSlug: 'acme', isSystemAdmin: false });
  };
  const follows = () => audit.entries.filter((e) => e.action === AuditAction.PARTICIPANT_ADDED);

  it('makes the agent who answers a follower, so the reply reaches them', async () => {
    await comment('admin');
    const followers = await participants.findByTicketId('T1');
    expect(followers.map((p) => [p.userId, p.role])).toEqual([['admin', 'follower']]);
  });

  it('does not add the reporter as a follower of their own ticket, nor twice the same person', async () => {
    await comment('carla');
    await comment('admin');
    await comment('admin');
    expect((await participants.findByTicketId('T1')).map((p) => p.userId)).toEqual(['admin']);
  });

  it('leaves in the audit log who started following and why, once', async () => {
    await comment('admin');
    await comment('admin');
    expect(follows().map((e) => [e.userId, e.metadata])).toEqual([
      ['admin', { participantUserId: 'admin', target: 'Admin Test (admin@acme.test)', role: 'follower', reason: 'comment' }],
    ]);
  });

  it('records who mentioned whom when a mention makes someone a follower', async () => {
    await comment('carla', 'Can you look? @[Sara Test](sara)');
    expect(follows().map((e) => [e.userId, e.metadata?.participantUserId, e.metadata?.reason])).toEqual([['carla', 'sara', 'mention']]);
  });
});
