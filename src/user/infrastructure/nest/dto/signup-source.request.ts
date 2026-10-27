import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Where the person came from, as their browser kept it from the first visit; cleaned by the domain. */
export class SignupSourceRequest {
  @IsOptional() @IsString() @MaxLength(500)
  referrer?: string;

  @IsOptional() @IsString() @MaxLength(200)
  utmSource?: string;

  @IsOptional() @IsString() @MaxLength(200)
  utmMedium?: string;

  @IsOptional() @IsString() @MaxLength(200)
  utmCampaign?: string;

  @IsOptional() @IsString() @MaxLength(200)
  ref?: string;

  @IsOptional() @IsString() @MaxLength(500)
  landingPath?: string;

  @IsOptional() @IsString() @MaxLength(40)
  firstSeenAt?: string;
}
