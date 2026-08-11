import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class ReportFilterDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['received', 'sent'])
  dateField?: 'received' | 'sent';
}
