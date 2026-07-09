import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { TicketModel } from './ticket.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('ticket_participants')
@Unique(['ticketId', 'userId'])
export class TicketParticipantModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  ticketId!: string;

  @ManyToOne(() => TicketModel, { onDelete: 'CASCADE' })
  ticket!: TicketModel;

  @Column()
  userId!: string;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  user!: UserModel;

  @Column({ default: 'follower' })
  role!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
