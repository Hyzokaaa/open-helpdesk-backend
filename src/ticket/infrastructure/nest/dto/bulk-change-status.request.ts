import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketDiscardReason } from '../../../domain/enums/ticket-discard-reason.enum';
import { TicketStatus } from '../../../domain/enums/ticket-status.enum';

export class BulkChangeStatusRequest {
  @IsArray()
  @IsString({ each: true })
  ticketIds!: string[];

  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsEnum(TicketDiscardReason)
  @IsOptional()
  discardReason?: TicketDiscardReason;
}
