import { IsOptional, IsString } from 'class-validator';

export class SortDto {
  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
