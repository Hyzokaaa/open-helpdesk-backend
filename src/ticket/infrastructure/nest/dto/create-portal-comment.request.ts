import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePortalCommentRequest {
  @IsString()
  @IsNotEmpty()
  content!: string;

  /** Files uploaded beforehand through POST /portal/:slug/uploads, attached to the new comment. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  uploadTokens?: string[];
}
