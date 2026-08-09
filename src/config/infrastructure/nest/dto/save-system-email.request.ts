import { IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';

export class SaveSystemEmailRequest {
  @IsString()
  smtpHost!: string;

  @IsNumber()
  smtpPort!: number;

  @IsString()
  smtpUser!: string;

  @IsString()
  @IsOptional()
  smtpPass?: string;

  @IsEmail()
  smtpFrom!: string;

  @IsString()
  @IsOptional()
  encryption?: string;
}
