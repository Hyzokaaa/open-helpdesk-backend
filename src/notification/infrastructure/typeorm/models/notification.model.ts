import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('notifications')
@Index(['userId', 'isRead'])
export class NotificationModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => UserModel)
  user!: UserModel;

  @Column()
  userId!: string;

  @Column()
  type!: string;

  @Column()
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  ticketId!: string | null;

  @Column()
  workspaceSlug!: string;

  @Column({ default: false })
  isRead!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
