import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('notice_preferences')
@Index(['userId', 'kind', 'channel'], { unique: true })
export class NoticePreferenceModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  user!: UserModel;

  @Column()
  userId!: string;

  @Column()
  kind!: string;

  @Column()
  channel!: string;

  @Column()
  enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
