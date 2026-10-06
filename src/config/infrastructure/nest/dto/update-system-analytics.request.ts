import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AnalyticsProvider } from '../../../domain/enums/analytics-provider.enum';

export class UpdateSystemAnalyticsRequest {
  @IsEnum(AnalyticsProvider)
  @IsOptional()
  provider?: AnalyticsProvider | null;

  @IsString()
  @MaxLength(2048)
  @IsOptional()
  serverUrl?: string | null;

  @IsString()
  @MaxLength(10)
  @IsOptional()
  siteId?: string | null;

  @IsBoolean()
  @IsOptional()
  useCookies?: boolean;

  @IsBoolean()
  @IsOptional()
  trackEvents?: boolean;
}
