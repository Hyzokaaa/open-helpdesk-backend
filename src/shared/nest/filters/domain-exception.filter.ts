import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
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

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = STATUS_MAP[exception.name] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }
}
