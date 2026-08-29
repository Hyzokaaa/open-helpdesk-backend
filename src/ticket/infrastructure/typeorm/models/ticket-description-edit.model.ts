import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TicketModel } from './ticket.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('ticket_description_edits')
export class TicketDescriptionEditModel {
  @PrimaryColumn()
  id!: string;

  @Column('text')
  content!: string;

  @ManyToOne(() => TicketModel, { onDelete: 'CASCADE' })
  ticket!: TicketModel;

  @Column()
  ticketId!: string;

  @ManyToOne(() => UserModel)
  editedBy!: UserModel;

  @Column()
  editedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
