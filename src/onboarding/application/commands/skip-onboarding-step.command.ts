import { Command } from '../../../shared/domain/command';
import { OnboardingState, ResolveOnboarding } from '../../domain/services/onboarding-resolve';
import { SkipOnboardingStep } from '../../domain/services/onboarding-step-skip';

interface Props {
  userId: string;
  step: string;
}

/** Leaves a step for later and answers where the person goes next. */
export class SkipOnboardingStepCommand implements Command<Props, OnboardingState> {
  constructor(
    private readonly skipStep: SkipOnboardingStep,
    private readonly resolveOnboarding: ResolveOnboarding,
  ) {}

  async execute(props: Props): Promise<OnboardingState> {
    await this.skipStep.execute({ userId: props.userId, step: props.step });
    return this.resolveOnboarding.execute({ userId: props.userId });
  }
}
