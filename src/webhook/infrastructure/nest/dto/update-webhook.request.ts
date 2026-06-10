import { IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateWebhookRequest {
  @IsUrl({ require_tld: false })
  @IsOptional()
  url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
