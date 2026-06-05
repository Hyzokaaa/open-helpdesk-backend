import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePortalCommentRequest {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
