import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TicketModel } from '../../../../ticket/infrastructure/typeorm/models/ticket.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('comments')
export class CommentModel {
  @PrimaryColumn()
  id!: string;

  @Column('text')
  content!: string;

  @ManyToOne(() => TicketModel)
  ticket!: TicketModel;

  @Column()
  ticketId!: string;

  @ManyToOne(() => UserModel)
  author!: UserModel;

  @Column()
  authorId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
