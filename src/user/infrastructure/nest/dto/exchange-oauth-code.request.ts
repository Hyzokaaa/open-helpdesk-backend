import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ExchangeOAuthCodeRequest {
  @IsString()
  code!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
