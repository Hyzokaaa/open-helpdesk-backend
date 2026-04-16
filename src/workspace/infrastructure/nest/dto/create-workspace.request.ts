import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWorkspaceRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description: string = '';

  @IsString()
  @IsOptional()
  dealerId?: string;
}
