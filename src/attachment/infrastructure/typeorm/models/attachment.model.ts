import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TicketModel } from '../../../../ticket/infrastructure/typeorm/models/ticket.model';
import { CommentModel } from '../../../../comment/infrastructure/typeorm/models/comment.model';

@Entity('attachments')
export class AttachmentModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  fileName!: string;

  @Column()
  originalName!: string;

  @Column()
  mimeType!: string;

  @Column()
  size!: number;

  @Column()
  s3Key!: string;

  @ManyToOne(() => TicketModel, { nullable: true, onDelete: 'CASCADE' })
  ticket!: TicketModel | null;

  @Column({ type: 'varchar', nullable: true })
  ticketId!: string | null;

  @ManyToOne(() => CommentModel, { nullable: true, onDelete: 'CASCADE' })
  comment!: CommentModel | null;

  @Column({ type: 'varchar', nullable: true })
  commentId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
