import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('notification_preferences')
export class NotificationPreferenceModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => UserModel)
  user!: UserModel;

  @Column({ unique: true })
  userId!: string;

  @Column({ default: true })
  emailEnabled!: boolean;

  @Column({ default: true })
  inAppEnabled!: boolean;

  @Column({ default: true })
  emailTicketCreated!: boolean;

  @Column({ default: true })
  emailTicketAssigned!: boolean;

  @Column({ default: true })
  emailStatusChanged!: boolean;

  @Column({ default: true })
  emailCommentCreated!: boolean;

  @Column({ default: true })
  inAppTicketCreated!: boolean;

  @Column({ default: true })
  inAppTicketAssigned!: boolean;

  @Column({ default: true })
  inAppStatusChanged!: boolean;

  @Column({ default: true })
  inAppCommentCreated!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
