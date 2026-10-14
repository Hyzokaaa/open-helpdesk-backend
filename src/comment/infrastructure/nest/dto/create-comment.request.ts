import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentRequest {
  @IsString()
  @IsNotEmpty()
  content!: string;

  /** Files uploaded beforehand through POST /uploads, attached to the new comment. Ignored when editing. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  uploadTokens?: string[];
}
