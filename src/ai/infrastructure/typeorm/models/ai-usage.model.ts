import {
  Column,
  Entity,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity('ai_usage')
@Unique(['workspaceId', 'month'])
export class AiUsageModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  workspaceId!: string;

  @Column()
  month!: string;

  @Column({ default: 0 })
  count!: number;
}
