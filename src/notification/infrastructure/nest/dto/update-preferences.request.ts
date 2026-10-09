import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Preferences always belong to the authenticated user: there is no `userId`
 * here on purpose, and the global `whitelist: true` ValidationPipe strips one
 * if a client sends it.
 */
export class UpdatePreferencesRequest {
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() inAppEnabled?: boolean;
  @IsOptional() @IsBoolean() emailTicketCreated?: boolean;
  @IsOptional() @IsBoolean() emailTicketAssigned?: boolean;
  @IsOptional() @IsBoolean() emailStatusChanged?: boolean;
  @IsOptional() @IsBoolean() emailCommentCreated?: boolean;
  @IsOptional() @IsBoolean() emailCsatSurvey?: boolean;
  @IsOptional() @IsBoolean() emailTransferRequest?: boolean;
  @IsOptional() @IsBoolean() inAppTicketCreated?: boolean;
  @IsOptional() @IsBoolean() inAppTicketAssigned?: boolean;
  @IsOptional() @IsBoolean() inAppStatusChanged?: boolean;
  @IsOptional() @IsBoolean() inAppTicketUnassigned?: boolean;
  @IsOptional() @IsBoolean() inAppCommentCreated?: boolean;
  @IsOptional() @IsBoolean() inAppTransferRequest?: boolean;
  @IsOptional() @IsBoolean() emailUpgradeAvailable?: boolean;
  @IsOptional() @IsBoolean() inAppUpgradeAvailable?: boolean;
  @IsOptional() @IsBoolean() inAppInvitationExpired?: boolean;
  @IsOptional() @IsBoolean() bellUnreadOnly?: boolean;
}
