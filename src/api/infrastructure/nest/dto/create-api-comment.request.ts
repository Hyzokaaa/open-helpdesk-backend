import { IsNotEmpty, IsString } from 'class-validator';

export class CreateApiCommentRequest {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
