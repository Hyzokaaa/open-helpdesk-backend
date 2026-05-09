import { IsDateString, IsOptional } from 'class-validator';

export class ReportFilterDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}
