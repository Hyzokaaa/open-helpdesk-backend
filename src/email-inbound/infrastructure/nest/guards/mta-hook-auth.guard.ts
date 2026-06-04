import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class MtaHookAuthGuard implements CanActivate {
  private readonly expectedUser: string;
  private readonly expectedSecret: string;

  constructor(private readonly config: ConfigService) {
    this.expectedUser = config.get<string>('MTA_HOOK_USER', 'mta-hook');
    this.expectedSecret = config.get<string>('MTA_HOOK_SECRET', '');
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.expectedSecret) {
      throw new UnauthorizedException('MTA_HOOK_SECRET not configured');
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing Basic auth');
    }

    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [user, secret] = decoded.split(':');

    if (!this.constantTimeEqual(user, this.expectedUser) || !this.constantTimeEqual(secret, this.expectedSecret)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return true;
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const key = Buffer.from('mta-hook-compare');
    const hmacA = createHmac('sha256', key).update(a).digest();
    const hmacB = createHmac('sha256', key).update(b).digest();
    return timingSafeEqual(hmacA, hmacB);
  }
}
