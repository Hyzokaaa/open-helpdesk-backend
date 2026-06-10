import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateWebhookRequest {
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsString()
  @IsOptional()
  secret?: string;
}
