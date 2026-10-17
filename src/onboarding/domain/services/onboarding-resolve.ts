import { EntityNotFoundError } from '../../../shared/domain/errors';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { ResolveWorkspaceCreationPolicy } from '../../../workspace/domain/services/workspace-creation-policy-resolve';
import { OnboardingStep } from '../onboarding-step';
import { OnboardingStepSkipRepository } from '../repositories/onboarding-step-skip.repository';

export interface OnboardingStepState {
  key: string;
  done: boolean;
  skippable: boolean;
}

export interface OnboardingState {
  /** Every step, in order, done or not: the client shows the progress with it. */
  steps: OnboardingStepState[];
  /** The first step still pending, or null when the onboarding is complete. */
  nextStep: string | null;
}

/** The core steps followed by an extension's, each placed after the step it names (or at the end). */
export function orderOnboardingSteps(core: OnboardingStep[], extra: OnboardingStep[]): OnboardingStep[] {
  const ordered = [...core];
  for (const step of extra) {
    const anchor = step.after ? ordered.findIndex((s) => s.key === step.after) : -1;
    ordered.splice(anchor === -1 ? ordered.length : anchor + 1, 0, step);
  }
  return ordered;
}

/**
 * Where a person is in the onboarding. Each step answers from the account's real state; only
 * the steps the person skipped are stored. Every way in (signup, sign-in, the verification link,
 * the dashboard) asks this, so none can let someone past a step or keep them in one.
 */
export class ResolveOnboarding {
  constructor(
    private readonly steps: OnboardingStep[],
    private readonly userRepository: UserRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly skipRepository: OnboardingStepSkipRepository,
    private readonly creationPolicy: ResolveWorkspaceCreationPolicy,
  ) {}

  async execute(props: { userId: string }): Promise<OnboardingState> {
    const user = await this.userRepository.findById(props.userId);
    if (!user) throw new EntityNotFoundError('User not found');

    const [memberships, skipped, policy] = await Promise.all([
      this.memberRepository.findByUserId(user.getId()),
      this.skipRepository.findStepsByUserId(user.getId()),
      this.creationPolicy.execute(),
    ]);
    const context = {
      userId: user.getId(),
      isEmailVerified: user.isEmailVerified,
      isSystemAdmin: user.isSystemAdmin,
      workspaceCount: memberships.length,
      canCreateWorkspace: user.isSystemAdmin || policy.selfService,
    };

    const steps: OnboardingStepState[] = [];
    for (const step of this.steps) {
      const pending = await step.isPending(context);
      const done = !pending || (step.skippable && skipped.includes(step.key));
      steps.push({ key: step.key, done, skippable: step.skippable });
    }
    return { steps, nextStep: steps.find((s) => !s.done)?.key ?? null };
  }
}
