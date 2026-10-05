import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AI_LANGUAGE_MAX_LENGTH, AI_TEXT_MAX_LENGTH } from './ai-request-limits';

export class ImproveTextRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(AI_TEXT_MAX_LENGTH)
  text!: string;

  @IsString()
  @IsNotEmpty()
  workspaceSlug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(AI_LANGUAGE_MAX_LENGTH)
  language?: string;
}
