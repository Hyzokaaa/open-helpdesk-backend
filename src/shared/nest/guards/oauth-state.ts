import { ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import { TokenService } from '../../domain/token-service';
import { IssueOAuthState, OAUTH_STATE_TTL_SECONDS } from '../../../user/domain/services/user-oauth-state';

/** Holds the nonce that binds a provider sign-in to the browser that started it. */
export const OAUTH_NONCE_COOKIE = 'ohd_oauth_nonce';

function isCallback(req: Request): boolean {
  const query = req.query ?? {};
  return query.code !== undefined || query.error !== undefined || query.state !== undefined;
}

/**
 * Passport options for the provider guards. On the way out it issues a signed, single-use state
 * and keeps its nonce in an httpOnly cookie; the callback is verified by the controller.
 */
export function oauthAuthenticateOptions(context: ExecutionContext, tokenService: TokenService): { state?: string } {
  const http = context.switchToHttp();
  const req = http.getRequest<Request>();
  if (isCallback(req)) return {};

  const redirect = typeof req.query?.redirect === 'string' ? req.query.redirect : null;
  const { state, browserNonce } = new IssueOAuthState(tokenService).execute({ redirect });
  http.getResponse<Response>().cookie(OAUTH_NONCE_COOKIE, browserNonce, {
    httpOnly: true,
    // Lax still travels on the provider's top-level redirect back to the callback
    sameSite: 'lax',
    secure: req.secure,
    path: '/',
    maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
  });
  return { state };
}

export function readOAuthNonce(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === OAUTH_NONCE_COOKIE) return decodeURIComponent(value.join('='));
  }
  return null;
}
