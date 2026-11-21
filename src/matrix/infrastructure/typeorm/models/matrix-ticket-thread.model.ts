import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { TicketModel } from '../../../../ticket/infrastructure/typeorm/models/ticket.model';

@Entity('matrix_ticket_threads')
@Unique(['ticketId', 'roomId'])
export class MatrixTicketThreadModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => TicketModel, { onDelete: 'CASCADE' })
  ticket!: TicketModel;

  @Column()
  ticketId!: string;

  /** The Matrix room ID (!…). */
  @Column()
  roomId!: string;

  @Column()
  rootEventId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
