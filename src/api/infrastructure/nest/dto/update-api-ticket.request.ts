import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketCategory } from '../../../../ticket/domain/enums/ticket-category.enum';
import { TicketPriority } from '../../../../ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../ticket/domain/enums/ticket-status.enum';

export class UpdateApiTicketRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsEnum(TicketCategory)
  @IsOptional()
  category?: TicketCategory;

  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @IsString()
  @IsOptional()
  assigneeId?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}
