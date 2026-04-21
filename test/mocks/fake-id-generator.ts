import { IdGenerator } from '../../src/shared/domain/id-generator';

export class FakeIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = 'test-id') {}

  create(): string {
    this.counter++;
    return `${this.prefix}-${this.counter}`;
  }
}
