import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  AccessDeniedError,
  ConflictError,
  DomainError,
  DomainValidationError,
  EntityNotFoundError,
  InvalidCredentialsError,
} from '../../domain/errors';

const STATUS_MAP: Record<string, HttpStatus> = {
  EntityNotFoundError: HttpStatus.NOT_FOUND,
  AccessDeniedError: HttpStatus.FORBIDDEN,
  ConflictError: HttpStatus.CONFLICT,
  DomainValidationError: HttpStatus.BAD_REQUEST,
  InvalidCredentialsError: HttpStatus.UNAUTHORIZED,
};

/** Told about every refused request, to audit it. Failing to record never changes the response. */
export interface AccessDeniedRecorder {
  record(error: AccessDeniedError, request: Request): Promise<void>;
}

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(private readonly accessDeniedRecorder?: AccessDeniedRecorder) {}

  catch(exception: DomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = STATUS_MAP[exception.name] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof AccessDeniedError && this.accessDeniedRecorder) {
      this.accessDeniedRecorder.record(exception, ctx.getRequest<Request>()).catch(() => undefined);
    }

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }
}
