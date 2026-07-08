import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { WorkspaceRole } from '../../../../workspace/domain/enums/workspace-role.enum';

export class ExchangeTokenRequest {
  @IsEmail()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole = WorkspaceRole.AGENT;
}
