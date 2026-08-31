import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CommentModel } from './comment.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('comment_edits')
export class CommentEditModel {
  @PrimaryColumn()
  id!: string;

  @Column('text')
  content!: string;

  @ManyToOne(() => CommentModel, { onDelete: 'CASCADE' })
  comment!: CommentModel;

  @Column()
  commentId!: string;

  @ManyToOne(() => UserModel)
  editedBy!: UserModel;

  @Column()
  editedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
