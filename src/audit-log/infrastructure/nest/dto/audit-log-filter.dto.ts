import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '../../../../shared/nest/dto/pagination.dto';
import { AuditAction } from '../../../domain/enums/audit-action.enum';
import { AuditCategory } from '../../../domain/enums/audit-category.enum';
import { AuditLevel } from '../../../domain/enums/audit-level.enum';

export class AuditLogFilterDto extends PaginationDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  actions?: string[];

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  entityTypes?: string[];

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  categories?: string[];

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  levels?: string[];

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  sources?: string[];

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  userIds?: string[];

  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  @Type(() => Date)
  dateFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  dateTo?: Date;

  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}
