import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_emails')
export class ProcessedEmailModel {
  @PrimaryColumn()
  messageId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
