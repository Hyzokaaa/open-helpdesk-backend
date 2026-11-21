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
  emailCsatSurvey!: boolean;

  @Column({ default: true })
  emailTransferRequest!: boolean;

  @Column({ default: true })
  inAppTicketCreated!: boolean;

  @Column({ default: true })
  inAppTicketAssigned!: boolean;

  @Column({ default: true })
  inAppStatusChanged!: boolean;

  @Column({ default: true })
  inAppTicketUnassigned!: boolean;

  @Column({ default: true })
  inAppCommentCreated!: boolean;

  @Column({ default: true })
  inAppTransferRequest!: boolean;

  @Column({ default: true })
  emailUpgradeAvailable!: boolean;

  @Column({ default: true })
  inAppUpgradeAvailable!: boolean;

  @Column({ default: true })
  inAppInvitationExpired!: boolean;

  @Column({ default: true })
  inAppUnattendedReply!: boolean;

  @Column({ default: true })
  emailUnattendedReply!: boolean;

  @Column({ default: true })
  inAppMentioned!: boolean;

  @Column({ default: true })
  emailMentioned!: boolean;

  @Column({ default: false })
  matrixEnabled!: boolean;

  @Column({ default: true })
  matrixTicketCreated!: boolean;

  @Column({ default: true })
  matrixTicketAssigned!: boolean;

  @Column({ default: true })
  matrixStatusChanged!: boolean;

  @Column({ default: true })
  matrixTicketUnassigned!: boolean;

  @Column({ default: true })
  matrixCommentCreated!: boolean;

  @Column({ default: true })
  matrixTransferRequest!: boolean;

  @Column({ default: true })
  matrixUnattendedReply!: boolean;

  @Column({ default: true })
  matrixMentioned!: boolean;

  @Column({ default: false })
  bellUnreadOnly!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
