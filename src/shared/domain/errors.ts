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

export class InvalidCredentialsError extends DomainError {}
