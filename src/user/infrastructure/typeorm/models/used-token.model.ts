import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('used_tokens')
@Index('IDX_used_tokens_expires_at', ['expiresAt'])
export class UsedTokenModel {
  /** `<type>:<jti>` of the spent token. */
  @PrimaryColumn()
  id!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
