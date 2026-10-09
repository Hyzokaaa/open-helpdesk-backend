import { NotifyExpiredInvitations } from '../../../../src/workspace/domain/services/invitation-notify-expired';
import { WorkspaceInvitation } from '../../../../src/workspace/domain/entities/workspace-invitation';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { InvitationStatus } from '../../../../src/workspace/domain/enums/invitation-status.enum';
import { User } from '../../../../src/user/domain/entities/user';
import { Notification } from '../../../../src/notification/domain/entities/notification';
import { DispatchNotifications } from '../../../../src/notification/domain/services/notification-dispatch';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { MockWorkspaceInvitationRepository } from '../../../mocks/mock-workspace-invitation.repository';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockNotificationPreferenceRepository } from '../../../mocks/mock-notification-preference.repository';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

const NOW = new Date('2026-10-09T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('Telling inviters that an invitation expired', () => {
  let invitations: MockWorkspaceInvitationRepository;
  let notifications: Notification[];
  let audit: MockAuditLogRepository;

  const invitation = (id: string, expiresAt: Date, status = InvitationStatus.PENDING) => new WorkspaceInvitation({
    id, workspaceId: 'ws-1', email: `${id}@x.com`, role: WorkspaceRole.AGENT, token: id,
    status, expiresAt, invitedById: 'inviter',
  });

  const run = () => {
    const users = new MockUserRepository();
    users.seed(new User({
      id: 'inviter', email: 'boss@x.com', password: 'x', firstName: 'Ana', lastName: 'B',
      isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'es', theme: 'system',
    }));
    const workspaces = new MockWorkspaceRepository();
    workspaces.seed(new Workspace({ id: 'ws-1', name: 'Support', slug: 'support', description: '' }));
    const dispatch = new DispatchNotifications(
      new FakeIdGenerator(),
      { create: async (n: Notification) => { notifications.push(n); } } as any,
      new MockNotificationPreferenceRepository(),
    );
    return new NotifyExpiredInvitations(invitations, workspaces, users, dispatch, new CreateAuditLogEntry(new FakeIdGenerator(), audit))
      .execute({ now: NOW, limit: 50 });
  };

  beforeEach(() => {
    invitations = new MockWorkspaceInvitationRepository();
    notifications = [];
    audit = new MockAuditLogRepository();
  });

  it('notifies the inviter in the app and records the expiry, for an invitation that just expired', async () => {
    await invitations.create(invitation('late', new Date(NOW.getTime() - HOUR)));
    expect(await run()).toBe(1);
    expect(notifications.map((n) => [n.userId, n.type, n.title, n.workspaceSlug])).toEqual([['inviter', 'invitation-expired', 'late@x.com', 'support']]);
    expect(audit.entries.map((e) => [e.action, e.userId])).toEqual([[AuditAction.INVITATION_EXPIRED, null]]);
  });

  it('tells each inviter once, however many times it runs', async () => {
    await invitations.create(invitation('late', new Date(NOW.getTime() - HOUR)));
    await run();
    expect(await run()).toBe(0);
    expect(notifications).toHaveLength(1);
  });

  it('leaves alone invitations still valid, accepted or cancelled', async () => {
    await invitations.create(invitation('valid', new Date(NOW.getTime() + HOUR)));
    await invitations.create(invitation('accepted', new Date(NOW.getTime() - HOUR), InvitationStatus.ACCEPTED));
    expect(await run()).toBe(0);
    expect(notifications).toHaveLength(0);
  });
});
