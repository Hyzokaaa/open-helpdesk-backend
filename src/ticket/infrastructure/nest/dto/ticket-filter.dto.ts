import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../../shared/nest/dto/pagination.dto';
import { TicketPriority } from '../../../domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../domain/enums/ticket-status.enum';
import { TicketFilters } from '../../../domain/repositories/ticket.repository';

/** In the department, organization and category filters, the tickets that have none. */
export const FILTER_NONE = 'none';
/** In the department filter, the departments the caller is an agent of. */
export const FILTER_MINE = 'mine';

/** "a,b" and repeated parameters (?status=a&status=b) both read as a list, without blanks or repeats. */
const toList = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return value;
  const parts = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const list = [...new Set(parts.map((v) => v.trim()).filter(Boolean))];
  return list.length ? list : undefined;
};

export class TicketFilterDto extends PaginationDto {
  @IsString()
  @IsOptional()
  search?: string;

  /** One status or several, comma-separated: tickets in any of them match. */
  @IsArray()
  @IsEnum(TicketStatus, { each: true })
  @IsOptional()
  @Transform(toList)
  status?: TicketStatus[];

  @IsString()
  @IsOptional()
  excludeStatus?: string;

  /** One priority or several, comma-separated. */
  @IsArray()
  @IsEnum(TicketPriority, { each: true })
  @IsOptional()
  @Transform(toList)
  priority?: TicketPriority[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(toList)
  tagIds?: string[];

  /** Department ids, comma-separated; `none` matches the tickets without one, `mine` those of the caller's departments. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(toList)
  departmentId?: string[];

  /** Organization ids, comma-separated; `none` matches the tickets without one. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(toList)
  organizationId?: string[];

  @IsString()
  @IsOptional()
  projectId?: string;

  /** Category ids, comma-separated; `none` matches the tickets without one. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(toList)
  categoryId?: string[];

  /** `true`: only the tickets reopened at least once. */
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value))
  reopened?: boolean;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  reporterId?: string;

  @IsString()
  @IsOptional()
  registeredById?: string;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}

const withNone = (ids?: string[]) => ids?.map((id) => (id === FILTER_NONE ? null : id));

/** The list filters a request asks for, with `none` read as "has none" and `mine` as the caller's departments. */
export function ticketFiltersOf(dto: TicketFilterDto, userId?: string): TicketFilters {
  const mine = !!userId && !!dto.departmentId?.includes(FILTER_MINE);
  return {
    search: dto.search,
    statuses: dto.status,
    excludeStatus: dto.excludeStatus,
    priorities: dto.priority,
    tagIds: dto.tagIds,
    departmentIds: withNone(dto.departmentId?.filter((id) => id !== FILTER_MINE)),
    ...(mine ? { departmentsOfUserId: userId } : {}),
    organizationIds: withNone(dto.organizationId),
    projectId: dto.projectId,
    categoryIds: withNone(dto.categoryId),
    reopened: dto.reopened,
    assigneeId: dto.assigneeId,
    reporterId: dto.reporterId,
    sortBy: dto.sortBy,
    sortOrder: dto.sortOrder,
  };
}
