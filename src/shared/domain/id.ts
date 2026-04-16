export class Id {
  private readonly value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error('Id cannot be empty');
    }
    this.value = value;
  }

  get(): string {
    return this.value;
  }
}
