import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtTokenService } from '../../infrastructure/jwt-token-service';
import { oauthAuthenticateOptions } from './oauth-state';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(@Inject() private readonly tokenService: JwtTokenService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return oauthAuthenticateOptions(context, this.tokenService);
  }
}
