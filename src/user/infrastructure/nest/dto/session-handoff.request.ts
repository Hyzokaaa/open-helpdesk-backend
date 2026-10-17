import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueSessionHandoffRequest {
  /** Origin that will receive the session, e.g. https://help.example.com. */
  @IsString()
  @MaxLength(300)
  audience!: string;

  @IsString()
  @MaxLength(128)
  codeChallenge!: string;
}

export class StartSessionHandoffRequest extends IssueSessionHandoffRequest {
  /** The refresh token kept on the installation's address, when it has a session. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}

export class ExchangeSessionHandoffRequest {
  @IsString()
  @MaxLength(2000)
  code!: string;

  @IsString()
  @MaxLength(128)
  codeVerifier!: string;
}
