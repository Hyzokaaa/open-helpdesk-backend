import { DomainValidationError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { OnboardingStep } from '../onboarding-step';
import { OnboardingStepSkip } from '../entities/onboarding-step-skip';
import { OnboardingStepSkipRepository } from '../repositories/onboarding-step-skip.repository';

/** Leaves a step for later; only steps that allow it (never the email verification). */
export class SkipOnboardingStep {
  constructor(
    private readonly steps: OnboardingStep[],
    private readonly idGenerator: IdGenerator,
    private readonly repository: OnboardingStepSkipRepository,
  ) {}

  async execute(props: { userId: string; step: string }): Promise<void> {
    const step = this.steps.find((s) => s.key === props.step);
    if (!step) throw new DomainValidationError(`Unknown onboarding step: ${props.step}`);
    if (!step.skippable) throw new DomainValidationError(`The ${props.step} step cannot be skipped`);
    await this.repository.create(new OnboardingStepSkip({ id: this.idGenerator.create(), userId: props.userId, step: props.step }));
  }
}
