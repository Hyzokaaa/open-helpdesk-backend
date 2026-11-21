import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConnectMatrixBotRequest {
  /** @user:server */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  /** Used once to log in; never saved. */
  @IsString()
  @IsOptional()
  @MaxLength(1024)
  password?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4096)
  accessToken?: string;

  /** Only when the server name does not lead to it. */
  @IsString()
  @IsOptional()
  @MaxLength(512)
  homeserverUrl?: string;
}
