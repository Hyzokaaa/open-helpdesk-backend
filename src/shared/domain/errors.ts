export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EntityNotFoundError extends DomainError {}

export class AccessDeniedError extends DomainError {}

export class ConflictError extends DomainError {}

export class DomainValidationError extends DomainError {}

export class InvalidCredentialsError extends DomainError {
  /** Why it failed, for the audit log only: the response never tells (e.g. whether the email exists). */
  constructor(message: string, readonly reason?: string) {
    super(message);
  }
}
