import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketPriority } from '../../../../ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../ticket/domain/enums/ticket-status.enum';

export class UpdateApiTicketRequest {
  @ApiPropertyOptional({ example: 'Cannot log in to the customer portal' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Ticket body. HTML is accepted and sanitized on the server.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: TicketPriority, enumName: 'TicketPriority' })
  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @ApiPropertyOptional({ description: 'Id of a ticket category of the key\'s workspace.' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: TicketStatus,
    enumName: 'TicketStatus',
    description: 'New status. Follows the ticket workflow: only admins and supervisors can move a ticket back to `open`, and `discarded` is rejected because this endpoint takes no discard reason.',
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'User id of the new assignee, who must be an agent of the workspace. `null` unassigns the ticket.',
  })
  @IsString()
  @IsOptional()
  assigneeId?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Replaces the ticket\'s tags with these tag ids.' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Custom field values keyed by field definition id, validated against the definitions.',
  })
  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}
