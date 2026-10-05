import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Either `{ key, source, result }` to store an entry or `{ key, clear: true }` to drop it. */
export class UpdateTicketAiCacheRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsBoolean()
  @IsOptional()
  clear?: boolean;
}
