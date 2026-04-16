import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

export class AddMemberRequest {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
