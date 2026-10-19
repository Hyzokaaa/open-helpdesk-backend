import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateWorkspacePortalAccessRequest {
  @IsOptional()
  @IsBoolean()
  portalEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  publicKbEnabled?: boolean;
}
