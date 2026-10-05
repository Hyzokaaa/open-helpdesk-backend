import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateMailboxRequest {
  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  imapHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort!: number;

  @IsString()
  @IsNotEmpty()
  imapUser!: string;

  @IsString()
  @IsNotEmpty()
  imapPass!: string;

  @IsOptional()
  @IsBoolean()
  imapTls?: boolean;

  @IsOptional()
  @IsString()
  encryption?: string;

  @IsOptional()
  @IsString()
  imapFolder?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pollInterval?: number;

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
