import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyScope } from '../../../../api-key/domain/enums/api-key-scope.enum';
import { ApiErrorBody } from '../dto/api-responses';

interface ScopedOperation {
  scope: ApiKeyScope;
  summary: string;
  description?: string;
  /** Whether the operation validates a body or query, and so can answer 400. */
  validates?: boolean;
  /** Whether the operation addresses a ticket by id, and so can answer 404. */
  addressesTicket?: boolean;
}

/** The scope sentence every operation description starts with. */
export function scopeRequirement(scope: ApiKeyScope): string {
  return `Requires scope \`${scope}\`.`;
}

/**
 * Documents a public API operation: summary, the scope it requires and the error responses
 * the guards, the validation pipe and the use cases can produce for it.
 */
export function ApiScopedOperation(op: ScopedOperation) {
  const description = [scopeRequirement(op.scope), op.description].filter(Boolean).join('\n\n');
  const decorators = [
    ApiOperation({ summary: op.summary, description }),
    ApiUnauthorizedResponse({ description: 'Missing `Authorization` header, expired key, or deactivated key creator.', type: ApiErrorBody }),
    ApiForbiddenResponse({
      description: `Unknown or revoked key, missing scope \`${op.scope}\`, or the key creator's workspace role does not allow it.`,
      type: ApiErrorBody,
    }),
    ApiTooManyRequestsResponse({ description: 'Rate limit exceeded. See `Retry-After`.', type: ApiErrorBody }),
  ];
  if (op.validates) {
    decorators.push(ApiBadRequestResponse({ description: 'Validation failed or a business rule rejected the request.', type: ApiErrorBody }));
  }
  if (op.addressesTicket) {
    decorators.push(ApiNotFoundResponse({ description: 'No ticket with this id in the key\'s workspace.', type: ApiErrorBody }));
  }
  return applyDecorators(...decorators);
}
