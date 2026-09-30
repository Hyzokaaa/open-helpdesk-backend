import { IsString } from 'class-validator';

/** Used by both /auth/refresh and /auth/logout. */
export class RefreshSessionRequest {
  @IsString()
  refreshToken!: string;
}
