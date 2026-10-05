import { IsEnum, IsOptional } from 'class-validator';
import { TicketStatus } from '../../../domain/enums/ticket-status.enum';

export class PickupTicketRequest {
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;
}
