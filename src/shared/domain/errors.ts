export class DomainError extends Error {
  /**
   * A stable name for the reason, for clients that show it in the user's language (the message is
   * English and may change). Only on errors the user can act on.
   */
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = this.constructor.name;
    if (code) this.code = code;
  }
}

export class EntityNotFoundError extends DomainError {}

/** The workspace's portal is closed: a 404 that tells the page to send people to sign in instead. */
export class PortalClosedError extends EntityNotFoundError {}

export class AccessDeniedError extends DomainError {}

export class ConflictError extends DomainError {}

export class DomainValidationError extends DomainError {}

/** Asked again too soon or too often: try later. */
export class TooManyRequestsError extends DomainError {}

export class InvalidCredentialsError extends DomainError {
  /** Why it failed, for the audit log only: the response never tells (e.g. whether the email exists). */
  constructor(message: string, readonly reason?: string) {
    super(message);
  }
}
