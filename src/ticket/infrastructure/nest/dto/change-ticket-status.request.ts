import { IsEnum } from 'class-validator';
import { TicketStatus } from '../../../domain/enums/ticket-status.enum';

export class ChangeTicketStatusRequest {
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
