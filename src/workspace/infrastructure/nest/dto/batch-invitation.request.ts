import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';

class InvitationEntry {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}

export class BatchInvitationRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvitationEntry)
  invitations!: InvitationEntry[];
}
