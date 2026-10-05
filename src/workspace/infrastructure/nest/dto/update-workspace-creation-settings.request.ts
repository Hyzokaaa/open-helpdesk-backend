import { IsBoolean } from 'class-validator';

export class UpdateWorkspaceCreationSettingsRequest {
  @IsBoolean()
  selfService!: boolean;
}
