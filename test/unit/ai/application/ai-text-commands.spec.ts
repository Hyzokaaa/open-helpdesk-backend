import { ImproveTextCommand } from '../../../../src/ai/application/commands/improve-text.command';
import { TranslateTextCommand } from '../../../../src/ai/application/commands/translate-text.command';
import { ImproveText } from '../../../../src/ai/domain/services/improve-text';
import { TranslateText } from '../../../../src/ai/domain/services/translate-text';
import { AIService, ChatCompletionOptions, ChatCompletionResult } from '../../../../src/ai/domain/ai.service';
import { AiUsageRepository } from '../../../../src/ai/domain/repositories/ai-usage.repository';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { AccessDeniedError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';

class FakeAIService implements AIService {
  calls = 0;
  async complete(_options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    this.calls++;
    return { content: 'fixed text', model: 'fake' };
  }
}

class InMemoryAiUsageRepository implements AiUsageRepository {
  counts = new Map<string, number>();
  async increment(workspaceKey: string, month: string): Promise<number> {
    const key = `${workspaceKey}:${month}`;
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
  async getCount(workspaceKey: string, month: string): Promise<number> {
    return this.counts.get(`${workspaceKey}:${month}`) ?? 0;
  }
  total(): number {
    return [...this.counts.values()].reduce((a, b) => a + b, 0);
  }
}

describe('AI text commands', () => {
  let ai: FakeAIService;
  let usage: InMemoryAiUsageRepository;
  let workspaces: MockWorkspaceRepository;
  let members: MockWorkspaceMemberRepository;

  beforeEach(() => {
    ai = new FakeAIService();
    usage = new InMemoryAiUsageRepository();
    workspaces = new MockWorkspaceRepository();
    members = new MockWorkspaceMemberRepository();
    workspaces.seed(new Workspace({ id: 'ws-victim', name: 'Victim', slug: 'victim', description: '' }));
    workspaces.seed(new Workspace({ id: 'ws-own', name: 'Own', slug: 'own', description: '' }));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-own', userId: 'outsider', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-victim', userId: 'reporter', role: WorkspaceRole.USER }));
  });

  function improve(): ImproveTextCommand {
    return new ImproveTextCommand(new ImproveText(ai), new EnsureWorkspacePermission(members), workspaces, usage);
  }

  function translate(): TranslateTextCommand {
    return new TranslateTextCommand(new TranslateText(ai), new EnsureWorkspacePermission(members), workspaces, usage);
  }

  it('refuses a user who is not a member of the named workspace, and spends nothing', async () => {
    // Before, any signed-in user could name any workspace slug and burn its AI quota.
    await expect(
      improve().execute({ workspaceSlug: 'victim', userId: 'outsider', isSystemAdmin: false, text: 'helo' }),
    ).rejects.toThrow(AccessDeniedError);
    await expect(
      translate().execute({ workspaceSlug: 'victim', userId: 'outsider', isSystemAdmin: false, text: 'hola', targetLanguage: 'en' }),
    ).rejects.toThrow(AccessDeniedError);

    expect(ai.calls).toBe(0);
    expect(usage.total()).toBe(0);
  });

  it('refuses an unknown workspace', async () => {
    await expect(
      improve().execute({ workspaceSlug: 'nope', userId: 'outsider', isSystemAdmin: false, text: 'helo' }),
    ).rejects.toThrow(EntityNotFoundError);
    expect(ai.calls).toBe(0);
  });

  it('lets any member who can comment use it, and counts usage against that workspace by slug', async () => {
    const result = await improve().execute({ workspaceSlug: 'victim', userId: 'reporter', isSystemAdmin: false, text: 'helo' });
    await translate().execute({ workspaceSlug: 'victim', userId: 'reporter', isSystemAdmin: false, text: 'hola', targetLanguage: 'en' });

    expect(result).toEqual({ result: 'fixed text' });
    expect(ai.calls).toBe(2);
    await new Promise((resolve) => setImmediate(resolve));
    expect(usage.total()).toBe(2);
    expect([...usage.counts.keys()].every((k) => k.startsWith('victim:'))).toBe(true);
  });

  it('lets a system admin through without membership', async () => {
    await expect(
      improve().execute({ workspaceSlug: 'victim', userId: 'root', isSystemAdmin: true, text: 'helo' }),
    ).resolves.toEqual({ result: 'fixed text' });
  });
});
