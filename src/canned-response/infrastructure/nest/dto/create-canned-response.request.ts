import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCannedResponseRequest {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
