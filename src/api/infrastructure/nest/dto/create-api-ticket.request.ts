import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketPriority } from '../../../../ticket/domain/enums/ticket-priority.enum';

export class CreateApiTicketRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds: string[] = [];

  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}
