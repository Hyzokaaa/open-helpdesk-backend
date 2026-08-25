import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const backendUrl = config.get('API_URL') || config.get('BACKEND_URL', 'http://localhost:3000');

    super({
      clientID: config.getOrThrow('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${backendUrl}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { emails?: { value: string }[]; name?: { givenName?: string; familyName?: string } },
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('No email found in Google profile'), undefined);
      return;
    }

    const user = {
      email,
      firstName: profile.name?.givenName || '',
      lastName: profile.name?.familyName || '',
      authProvider: 'google',
    };
    done(null, user);
  }
}
