import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { CreateInvitationCommand } from '../../../../src/workspace/application/commands/create-invitation.command';
import { BatchInvitationCommand } from '../../../../src/workspace/application/commands/batch-invitation.command';
import { CreateInvitation } from '../../../../src/workspace/domain/services/invitation-create';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakeTokenService } from '../../../mocks/fake-token-service';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockWorkspaceInvitationRepository } from '../../../mocks/mock-workspace-invitation.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';

const WS = 'ws-1';

describe('Inviting as admin', () => {
  let invitations: MockWorkspaceInvitationRepository;
  let members: MockWorkspaceMemberRepository;
  let create: CreateInvitationCommand;
  let batch: BatchInvitationCommand;

  beforeEach(() => {
    invitations = new MockWorkspaceInvitationRepository();
    members = new MockWorkspaceMemberRepository();
    members.seed(new WorkspaceMember({ id: 'm-admin', workspaceId: WS, userId: 'admin', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-sup', workspaceId: WS, userId: 'supervisor', role: WorkspaceRole.SUPERVISOR }));
    members.seed(new WorkspaceMember({ id: 'm-agent', workspaceId: WS, userId: 'agent', role: WorkspaceRole.AGENT }));

    const service = new CreateInvitation(
      new FakeIdGenerator(),
      invitations,
      members,
      new MockUserRepository(),
      new FakeTokenService(),
    );
    const ensurePermission = new EnsureWorkspacePermission(members);
    create = new CreateInvitationCommand(service, ensurePermission);
    batch = new BatchInvitationCommand(service, ensurePermission);
  });

  const invite = (requestingUserId: string, role: WorkspaceRole, isSystemAdmin = false) =>
    create.execute({ workspaceId: WS, email: 'new@example.com', role, requestingUserId, isSystemAdmin });

  it('is refused to a supervisor, and no invitation is created', async () => {
    await expect(invite('supervisor', WorkspaceRole.ADMIN)).rejects.toThrow(AccessDeniedError);
    expect(invitations.all()).toHaveLength(0);
  });

  it('is allowed to a workspace admin', async () => {
    const result = await invite('admin', WorkspaceRole.ADMIN);
    expect(result.role).toBe(WorkspaceRole.ADMIN);
    expect(invitations.all()).toHaveLength(1);
  });

  it('is allowed to a system admin who is not a member', async () => {
    const result = await invite('sys-admin', WorkspaceRole.ADMIN, true);
    expect(result.role).toBe(WorkspaceRole.ADMIN);
  });

  it('still lets a supervisor invite roles below admin', async () => {
    await invite('supervisor', WorkspaceRole.SUPERVISOR);
    const second = await create.execute({
      workspaceId: WS, email: 'agent@example.com', role: WorkspaceRole.AGENT, requestingUserId: 'supervisor', isSystemAdmin: false,
    });
    expect(second.role).toBe(WorkspaceRole.AGENT);
    expect(invitations.all().map((i) => i.role)).toEqual([WorkspaceRole.SUPERVISOR, WorkspaceRole.AGENT]);
  });

  it('still refuses an agent, who cannot invite at all', async () => {
    await expect(invite('agent', WorkspaceRole.USER)).rejects.toThrow(AccessDeniedError);
  });

  it('rejects a whole batch from a supervisor when any entry is admin, before creating anything', async () => {
    await expect(
      batch.execute({
        workspaceId: WS,
        requestingUserId: 'supervisor',
        isSystemAdmin: false,
        invitations: [
          { email: 'a@example.com', role: WorkspaceRole.AGENT },
          { email: 'b@example.com', role: WorkspaceRole.ADMIN },
        ],
      }),
    ).rejects.toThrow(AccessDeniedError);
    expect(invitations.all()).toHaveLength(0);

    const results = await batch.execute({
      workspaceId: WS,
      requestingUserId: 'supervisor',
      isSystemAdmin: false,
      invitations: [{ email: 'a@example.com', role: WorkspaceRole.AGENT }],
    });
    expect(results).toEqual([{ email: 'a@example.com', status: 'sent' }]);
  });
});
