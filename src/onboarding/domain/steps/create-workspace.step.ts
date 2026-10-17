import { OnboardingContext, OnboardingStep } from '../onboarding-step';

/**
 * A first workspace, for whoever may create one and belongs to none yet. Someone invited, or
 * added by an admin, already belongs to one; someone who may not create one is not asked.
 */
export class CreateWorkspaceStep implements OnboardingStep {
  readonly key = 'workspace';
  readonly skippable = true;

  async isPending(context: OnboardingContext): Promise<boolean> {
    return context.canCreateWorkspace && context.workspaceCount === 0;
  }
}
