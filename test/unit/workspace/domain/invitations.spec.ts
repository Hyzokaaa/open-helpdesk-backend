import { ConflictError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { CreateInvitation } from '../../../../src/workspace/domain/services/invitation-create';
import { ResendInvitation } from '../../../../src/workspace/domain/services/invitation-resend';
import { CancelInvitation } from '../../../../src/workspace/domain/services/invitation-cancel';
import { WorkspaceInvitation } from '../../../../src/workspace/domain/entities/workspace-invitation';
import { InvitationStatus } from '../../../../src/workspace/domain/enums/invitation-status.enum';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { MockWorkspaceInvitationRepository } from '../../../mocks/mock-workspace-invitation.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakeTokenService } from '../../../mocks/fake-token-service';

describe('Resending and cancelling an invitation stay inside its workspace', () => {
  let repository: MockWorkspaceInvitationRepository;

  beforeEach(async () => {
    repository = new MockWorkspaceInvitationRepository();
    await repository.create(new WorkspaceInvitation({
      id: 'inv-1',
      workspaceId: 'ws-1',
      email: 'a@example.com',
      role: WorkspaceRole.AGENT,
      token: 'old-token',
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 1000),
      invitedById: 'user-1',
    }));
  });

  it('resends an invitation of the same workspace', async () => {
    const invitation = await new ResendInvitation(repository).execute({ invitationId: 'inv-1', workspaceId: 'ws-1' });
    expect(invitation.token).not.toBe('old-token');
  });

  it('refuses to resend an invitation of another workspace and leaves it untouched', async () => {
    await expect(new ResendInvitation(repository).execute({ invitationId: 'inv-1', workspaceId: 'ws-2' }))
      .rejects.toThrow(EntityNotFoundError);
    expect((await repository.findById('inv-1'))!.token).toBe('old-token');
  });

  it('cancels an invitation of the same workspace', async () => {
    await new CancelInvitation(repository).execute({ invitationId: 'inv-1', workspaceId: 'ws-1' });
    expect((await repository.findById('inv-1'))!.status).toBe(InvitationStatus.CANCELLED);
  });

  it('refuses to cancel an invitation of another workspace and leaves it pending', async () => {
    await expect(new CancelInvitation(repository).execute({ invitationId: 'inv-1', workspaceId: 'ws-2' }))
      .rejects.toThrow(EntityNotFoundError);
    expect((await repository.findById('inv-1'))!.status).toBe(InvitationStatus.PENDING);
  });
});

describe('Inviting an email that already has a pending invitation', () => {
  let repository: MockWorkspaceInvitationRepository;
  let create: CreateInvitation;

  const seed = (expiresAt: Date) => repository.create(new WorkspaceInvitation({
    id: 'inv-old',
    workspaceId: 'ws-1',
    email: 'a@example.com',
    role: WorkspaceRole.AGENT,
    token: 'old-token',
    status: InvitationStatus.PENDING,
    expiresAt,
    invitedById: 'user-1',
  }));
  const invite = () => create.execute({ workspaceId: 'ws-1', email: 'a@example.com', role: WorkspaceRole.AGENT, invitedById: 'user-1' });

  beforeEach(() => {
    repository = new MockWorkspaceInvitationRepository();
    create = new CreateInvitation(new FakeIdGenerator(), repository, new MockWorkspaceMemberRepository(), new MockUserRepository(), new FakeTokenService());
  });

  it('is refused while that invitation is still valid', async () => {
    await seed(new Date(Date.now() + 60_000));
    await expect(invite()).rejects.toThrow(ConflictError);
  });

  it('replaces an expired invitation with a new one', async () => {
    await seed(new Date(Date.now() - 60_000));
    const invitation = await invite();
    expect(invitation.getId()).not.toBe('inv-old');
    expect((await repository.findById('inv-old'))!.status).toBe(InvitationStatus.CANCELLED);
    expect((await repository.findPendingByWorkspaceAndEmail('ws-1', 'a@example.com'))!.getId()).toBe(invitation.getId());
  });
});
