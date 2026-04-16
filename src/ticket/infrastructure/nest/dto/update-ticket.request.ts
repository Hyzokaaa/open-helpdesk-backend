import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketCategory } from '../../../domain/enums/ticket-category.enum';
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

  @IsEnum(TicketCategory)
  @IsOptional()
  category?: TicketCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}
