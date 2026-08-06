import { IsNumber, IsOptional, IsString } from 'class-validator';

export class TestSystemEmailRequest {
  @IsString()
  smtpHost!: string;

  @IsNumber()
  smtpPort!: number;

  @IsString()
  smtpUser!: string;

  @IsString()
  @IsOptional()
  smtpPass?: string;

  @IsString()
  @IsOptional()
  encryption?: string;
}
