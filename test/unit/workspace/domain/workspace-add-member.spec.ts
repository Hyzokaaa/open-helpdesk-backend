import { AddWorkspaceMember } from '../../../../src/workspace/domain/services/workspace-add-member';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { ConflictError } from '../../../../src/shared/domain/errors';

describe('AddWorkspaceMember', () => {
  let service: AddWorkspaceMember;
  let repository: MockWorkspaceMemberRepository;

  beforeEach(() => {
    repository = new MockWorkspaceMemberRepository();
    service = new AddWorkspaceMember(new FakeIdGenerator(), repository);
  });

  it('should add a member to the workspace', async () => {
    const member = await service.execute({ workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.AGENT });

    expect(member.workspaceId).toBe('ws-1');
    expect(member.userId).toBe('user-1');
    expect(member.role).toBe(WorkspaceRole.AGENT);
  });

  it('should throw ConflictError when user is already a member', async () => {
    repository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.ADMIN }));

    await expect(
      service.execute({ workspaceId: 'ws-1', userId: 'user-1', role: WorkspaceRole.AGENT }),
    ).rejects.toThrow(ConflictError);
  });
});
