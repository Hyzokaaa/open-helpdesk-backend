import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('onboarding_step_skips')
@Unique(['userId', 'step'])
export class OnboardingStepSkipModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  user!: UserModel;

  @Column()
  step!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
