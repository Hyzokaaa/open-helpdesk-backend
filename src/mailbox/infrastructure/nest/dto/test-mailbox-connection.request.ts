import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class TestMailboxConnectionRequest {
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

  /** Empty or `__keep__` reuses the stored password of `mailboxId`. */
  @IsOptional()
  @IsString()
  imapPass?: string;

  @IsOptional()
  @IsBoolean()
  imapTls?: boolean;

  @IsOptional()
  @IsString()
  encryption?: string;

  /** A mailbox of the same workspace whose stored password should be reused. */
  @IsOptional()
  @IsString()
  mailboxId?: string;
}
