import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketCategory } from '../../../domain/enums/ticket-category.enum';
import { TicketPriority } from '../../../domain/enums/ticket-priority.enum';

export class CreateTicketRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @IsEnum(TicketCategory)
  category!: TicketCategory;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds: string[] = [];
}
