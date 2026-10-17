import { OnboardingStepSkip } from '../entities/onboarding-step-skip';

export interface OnboardingStepSkipRepository {
  /** Records the skip; skipping a step twice keeps one record. */
  create(skip: OnboardingStepSkip): Promise<void>;
  findStepsByUserId(userId: string): Promise<string[]>;
}
