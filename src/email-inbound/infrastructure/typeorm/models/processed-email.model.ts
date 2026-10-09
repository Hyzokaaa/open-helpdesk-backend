import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_emails')
export class ProcessedEmailModel {
  @PrimaryColumn()
  messageId!: string;

  /**
   * The mailbox that read it: two mailboxes on the same inbox each decide on their own copy.
   * `*` marks entries from before this column, which count as read by every mailbox.
   */
  @PrimaryColumn()
  mailboxId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
