import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { TicketModel } from './ticket.model';
import { CommentModel } from '../../../../comment/infrastructure/typeorm/models/comment.model';

@Entity('email_quotes')
@Index('IDX_email_quotes_ticket', ['ticketId'])
@Index('UQ_email_quotes_comment', ['commentId'], { unique: true, where: '"commentId" IS NOT NULL' })
@Index('UQ_email_quotes_description', ['ticketId'], { unique: true, where: '"commentId" IS NULL' })
export class EmailQuoteModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  ticketId!: string;

  @ManyToOne(() => TicketModel, { onDelete: 'CASCADE' })
  ticket!: TicketModel;

  @Column({ type: 'varchar', nullable: true })
  commentId!: string | null;

  @ManyToOne(() => CommentModel, { onDelete: 'CASCADE', nullable: true })
  comment!: CommentModel | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int' })
  lineCount!: number;

  @Column({ type: 'varchar' })
  method!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
