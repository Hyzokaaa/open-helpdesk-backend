import { IsEnum, IsOptional } from 'class-validator';
import { TicketDiscardReason } from '../../../domain/enums/ticket-discard-reason.enum';
import { TicketStatus } from '../../../domain/enums/ticket-status.enum';

export class ChangeTicketStatusRequest {
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsEnum(TicketDiscardReason)
  @IsOptional()
  discardReason?: TicketDiscardReason;
}
