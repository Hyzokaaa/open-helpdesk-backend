import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
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

  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  uploadTokens?: string[];

  @IsEmail()
  @IsOptional()
  onBehalfOf?: string;
}
