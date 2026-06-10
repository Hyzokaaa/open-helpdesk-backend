import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // If the token starts with ohd_, skip JWT validation — ApiKeyAuthGuard handles it
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token.startsWith('ohd_')) return true;
    }

    return super.canActivate(context);
  }
}
