import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TypeOrmApiKeyRepository } from '../../../api-key/infrastructure/typeorm/repositories/typeorm-api-key.repository';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly apiKeyRepository: TypeOrmApiKeyRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();

    // If already authenticated by JWT, skip API key check
    if (request.user) return true;

    const authHeader = request.headers?.authorization;
    if (!authHeader) return false;

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token.startsWith('ohd_')) return false;

    const hash = createHash('sha256').update(token).digest('hex');
    const apiKey = await this.apiKeyRepository.findByHash(hash);
    if (!apiKey) return false;

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    // Set user context similar to JWT
    request.user = {
      userId: apiKey.createdById,
      email: '',
      isSystemAdmin: false,
      isEmailVerified: true,
      apiKeyId: apiKey.getId(),
      workspaceId: apiKey.workspaceId,
      apiKeyScopes: apiKey.scopes,
    };

    // Update lastUsedAt in background
    this.apiKeyRepository.updateLastUsedAt(apiKey.getId(), new Date()).catch(() => {});

    return true;
  }
}
