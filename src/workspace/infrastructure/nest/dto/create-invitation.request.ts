import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

export class CreateInvitationRequest {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
