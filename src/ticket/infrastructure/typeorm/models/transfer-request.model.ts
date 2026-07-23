import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TicketModel } from './ticket.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('transfer_requests')
export class TransferRequestModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  ticketId!: string;

  @ManyToOne(() => TicketModel, { onDelete: 'CASCADE' })
  ticket!: TicketModel;

  @Column()
  requesterId!: string;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  requester!: UserModel;

  @Column()
  targetUserId!: string;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  targetUser!: UserModel;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
