import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketPriority } from '../../../domain/enums/ticket-priority.enum';

export class UpdateTicketRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @IsString()
  @IsOptional()
  departmentId?: string | null;

  @IsString()
  @IsOptional()
  organizationId?: string | null;

  @IsString()
  @IsOptional()
  projectId?: string | null;

  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}
