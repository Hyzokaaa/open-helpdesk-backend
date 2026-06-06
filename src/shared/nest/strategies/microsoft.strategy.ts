import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';

interface MicrosoftProfile {
  emails?: { value: string }[];
  name?: { givenName?: string; familyName?: string };
  displayName?: string;
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(config: ConfigService) {
    const backendUrl = config.get('BACKEND_URL', 'http://localhost:3000');

    super({
      clientID: config.getOrThrow('MICROSOFT_CLIENT_ID'),
      clientSecret: config.getOrThrow('MICROSOFT_CLIENT_SECRET'),
      callbackURL: `${backendUrl}/auth/microsoft/callback`,
      scope: ['user.read'],
      tenant: 'common',
      authorizationURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: MicrosoftProfile,
    done: (err: Error | null, user?: Record<string, string>) => void,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('No email found in Microsoft profile'));
      return;
    }

    const user = {
      email,
      firstName: profile.name?.givenName || profile.displayName || '',
      lastName: profile.name?.familyName || '',
      authProvider: 'microsoft',
    };
    done(null, user);
  }
}
