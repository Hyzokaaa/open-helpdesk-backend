import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDepartmentRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  /** The agents it starts with (admins, supervisors or agents of the workspace). */
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsOptional()
  memberUserIds?: string[];
}
