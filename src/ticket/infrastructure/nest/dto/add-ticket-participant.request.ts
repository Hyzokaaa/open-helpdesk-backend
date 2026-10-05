import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ParticipantRole } from '../../../domain/enums/participant-role.enum';

export class AddTicketParticipantRequest {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(ParticipantRole)
  @IsOptional()
  role?: ParticipantRole;
}
