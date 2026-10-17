import { ResolveOnboarding, orderOnboardingSteps } from '../../../src/onboarding/domain/services/onboarding-resolve';
import { SkipOnboardingStep } from '../../../src/onboarding/domain/services/onboarding-step-skip';
import { OnboardingStep } from '../../../src/onboarding/domain/onboarding-step';
import { VerifyEmailStep } from '../../../src/onboarding/domain/steps/verify-email.step';
import { CreateWorkspaceStep } from '../../../src/onboarding/domain/steps/create-workspace.step';
import { ResolveWorkspaceCreationPolicy } from '../../../src/workspace/domain/services/workspace-creation-policy-resolve';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { DomainValidationError, EntityNotFoundError } from '../../../src/shared/domain/errors';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';
import { MockOnboardingStepSkipRepository } from '../../mocks/mock-onboarding-step-skip.repository';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { makeMember, makeUser } from '../ticket/application/ticket-security-fixtures';

/** An extension step like cloud's plan: pending until the person has one. */
const planStep = (hasPlan: Set<string>): OnboardingStep => ({
  key: 'plan',
  skippable: true,
  after: 'verify',
  isPending: async (ctx) => ctx.canCreateWorkspace && ctx.workspaceCount === 0 && !hasPlan.has(ctx.userId),
});

describe('Onboarding', () => {
  let users: MockUserRepository;
  let members: MockWorkspaceMemberRepository;
  let skips: MockOnboardingStepSkipRepository;
  let hasPlan: Set<string>;
  let selfService: boolean;

  const steps = () => orderOnboardingSteps([new VerifyEmailStep(), new CreateWorkspaceStep()], [planStep(hasPlan)]);
  const policy = () => new ResolveWorkspaceCreationPolicy({ find: async () => null } as any, selfService);
  const resolve = (userId: string) => new ResolveOnboarding(steps(), users, members, skips, policy()).execute({ userId });
  const skip = (userId: string, step: string) => new SkipOnboardingStep(steps(), new FakeIdGenerator(), skips).execute({ userId, step });

  beforeEach(() => {
    users = new MockUserRepository();
    members = new MockWorkspaceMemberRepository();
    skips = new MockOnboardingStepSkipRepository();
    hasPlan = new Set();
    selfService = true;
  });

  const seedUser = (id: string, changes: { isEmailVerified?: boolean; isSystemAdmin?: boolean } = {}) => {
    const user = makeUser(id);
    Object.assign(user, changes);
    users.seed(user);
  };

  it("places an extension's step after the one it names", () => {
    expect(steps().map((s) => s.key)).toEqual(['verify', 'plan', 'workspace']);
  });

  it('takes a new signup through every step, in order, as each is done', async () => {
    seedUser('new', { isEmailVerified: false });
    expect(await resolve('new')).toEqual({
      nextStep: 'verify',
      steps: [
        { key: 'verify', done: false, skippable: false },
        { key: 'plan', done: false, skippable: true },
        { key: 'workspace', done: false, skippable: true },
      ],
    });

    (await users.findById('new'))!.isEmailVerified = true;
    expect((await resolve('new')).nextStep).toBe('plan');

    hasPlan.add('new');
    expect((await resolve('new')).nextStep).toBe('workspace');

    members.seed(makeMember('new', WorkspaceRole.ADMIN));
    expect((await resolve('new')).nextStep).toBeNull();
  });

  it('sends a verified account with no workspace (a Google signup) to the plan, not to the dashboard', async () => {
    seedUser('google');
    expect((await resolve('google')).nextStep).toBe('plan');
  });

  it('asks nothing of whoever already belongs to a workspace: invited members, customers, existing users', async () => {
    for (const [id, role] of [['agent', WorkspaceRole.AGENT], ['customer', WorkspaceRole.USER], ['owner', WorkspaceRole.ADMIN]] as const) {
      seedUser(id);
      members.seed(makeMember(id, role));
      expect((await resolve(id)).nextStep).toBeNull();
    }
  });

  it('does not ask for a plan or a workspace where people may not create workspaces', async () => {
    selfService = false;
    seedUser('plain');
    expect((await resolve('plain')).nextStep).toBeNull();
    seedUser('admin', { isSystemAdmin: true });
    expect((await resolve('admin')).nextStep).toBe('plan');
  });

  it('still asks to verify the email before anything else, also to members of a workspace', async () => {
    seedUser('unverified', { isEmailVerified: false });
    members.seed(makeMember('unverified', WorkspaceRole.AGENT));
    expect((await resolve('unverified')).nextStep).toBe('verify');
  });

  it('lets a person leave the plan and the workspace for later, but never the verification', async () => {
    seedUser('skipper');
    await skip('skipper', 'plan');
    await skip('skipper', 'plan');
    expect((await resolve('skipper')).nextStep).toBe('workspace');
    await skip('skipper', 'workspace');
    expect((await resolve('skipper')).nextStep).toBeNull();
    expect(skips.skips).toHaveLength(2);

    await expect(skip('skipper', 'verify')).rejects.toThrow(DomainValidationError);
    await expect(skip('skipper', 'unknown')).rejects.toThrow(DomainValidationError);
  });

  it('fails for an unknown user', async () => {
    await expect(resolve('ghost')).rejects.toThrow(EntityNotFoundError);
  });
});
