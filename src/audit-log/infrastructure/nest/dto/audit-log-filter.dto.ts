import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../../shared/nest/dto/pagination.dto';
import { AuditAction } from '../../../domain/enums/audit-action.enum';

export class AuditLogFilterDto extends PaginationDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @IsString()
  @IsOptional()
  entityType?: string;

  @IsString()
  @IsOptional()
  entityId?: string;

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
