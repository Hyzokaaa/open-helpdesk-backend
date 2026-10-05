import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Mailbox edits. The mailbox is identified by the URL, never by the body:
 * there is deliberately no `id` or `workspaceId` field here, and the global
 * `whitelist: true` ValidationPipe strips them if a client sends them.
 * `@IsOptional()` also lets a field through as `null`, which clears it.
 */
export class UpdateMailboxRequest {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  imapHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort?: number | null;

  @IsOptional()
  @IsString()
  imapUser?: string | null;

  @IsOptional()
  @IsString()
  imapPass?: string | null;

  @IsOptional()
  @IsBoolean()
  imapTls?: boolean | null;

  @IsOptional()
  @IsString()
  encryption?: string;

  @IsOptional()
  @IsString()
  imapFolder?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  pollInterval?: number | null;

  @IsOptional()
  @IsString()
  addressMode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedAddresses?: string[];

  @IsOptional()
  @IsBoolean()
  autoReply?: boolean;

  @IsOptional()
  @IsString()
  postProcessAction?: string;

  @IsOptional()
  @IsString()
  postProcessFolder?: string | null;
}
