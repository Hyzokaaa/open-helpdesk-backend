import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  userId: string;
  step: string;
}

/** A step the person chose to leave for later: the only part of the onboarding that is stored. */
export class OnboardingStepSkip {
  readonly id: Id;
  userId: string;
  step: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.userId = props.userId;
    this.step = props.step;
  }

  getId(): string {
    return this.id.get();
  }
}
