import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { WorkspaceRole } from '../../../../workspace/domain/enums/workspace-role.enum';

export class ExchangeTokenRequest {
  @ApiProperty({ format: 'email', description: 'Email of the user to sign in. Identifies the account.', example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'First name. Updates an existing user whose name differs.', example: 'Jane' })
  @IsString()
  firstName!: string;

  @ApiProperty({ description: 'Last name. Updates an existing user whose name differs.', example: 'Doe' })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({
    enum: WorkspaceRole,
    enumName: 'WorkspaceRole',
    default: WorkspaceRole.AGENT,
    description: 'Workspace role given to a user the exchange creates. An existing member keeps their role. `admin` and `supervisor` require the `auth:exchange:admin` scope.',
  })
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole = WorkspaceRole.AGENT;
}
