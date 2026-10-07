import { CanActivate, ExecutionContext, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ACCEPTS_API_KEY } from '../decorators/api-key-auth.decorator';
import { TypeOrmApiKeyRepository } from '../../../api-key/infrastructure/typeorm/repositories/typeorm-api-key.repository';
import { TypeOrmUserRepository } from '../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmWorkspaceRepository } from '../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly apiKeyRepository: TypeOrmApiKeyRepository,
    private readonly userRepository: TypeOrmUserRepository,
    @Optional() private readonly workspaceRepository?: TypeOrmWorkspaceRepository,
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

    // A key is bound to one workspace and a set of scopes, which only the public API enforces.
    // Anywhere else it would act as its creator with all their access, so it is refused there.
    const acceptsApiKey = this.reflector.getAllAndOverride<boolean>(ACCEPTS_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!acceptsApiKey) {
      throw new UnauthorizedException('API keys are only accepted on /api/v1');
    }

    const hash = createHash('sha256').update(token).digest('hex');
    const apiKey = await this.apiKeyRepository.findByHash(hash);
    if (!apiKey) return false;

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    // A key acts on behalf of its creator, so it stops working once the creator can no longer sign in.
    const creator = await this.userRepository.findById(apiKey.createdById);
    if (!creator || !creator.isActive) {
      throw new UnauthorizedException('The user who created this API key is no longer active');
    }

    // The keys of a deleted workspace stop working with it (and work again if it is restored)
    if (this.workspaceRepository && !(await this.workspaceRepository.findById(apiKey.workspaceId))) {
      throw new UnauthorizedException('The workspace of this API key no longer exists');
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
