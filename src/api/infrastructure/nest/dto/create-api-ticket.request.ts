import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TicketPriority } from '../../../../ticket/domain/enums/ticket-priority.enum';

export class CreateApiTicketRequest {
  @ApiProperty({ description: 'Ticket title.', minLength: 3, example: 'Cannot log in to the portal' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({
    description: 'Ticket body. HTML is accepted and sanitized on the server. Defaults to an empty string.',
    example: '<p>The login page says my password is wrong since this morning.</p>',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: TicketPriority, enumName: 'TicketPriority', example: TicketPriority.MEDIUM })
  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @ApiProperty({ description: 'Id of a ticket category of the key\'s workspace.', example: '01JABCDEF0123456789ABCDEFG' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiPropertyOptional({ type: [String], description: 'Ids of tags of the key\'s workspace.', default: [] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds: string[] = [];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Values for the workspace\'s custom fields, keyed by field definition id. Validated against the field definitions; required fields must be present.',
    example: { '01JFIELD0123456789ABCDEFGH': 'ACME-1234' },
  })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}
