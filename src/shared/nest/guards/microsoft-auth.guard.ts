import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtTokenService } from '../../infrastructure/jwt-token-service';
import { oauthAuthenticateOptions } from './oauth-state';

@Injectable()
export class MicrosoftAuthGuard extends AuthGuard('microsoft') {
  constructor(@Inject() private readonly tokenService: JwtTokenService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return oauthAuthenticateOptions(context, this.tokenService);
  }
}
