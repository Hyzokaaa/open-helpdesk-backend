import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TicketPriority } from '../../../domain/enums/ticket-priority.enum';

export class CreateTicketRequest {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
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

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  uploadTokens?: string[];

  @IsEmail()
  @IsOptional()
  onBehalfOf?: string;
}
