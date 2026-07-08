import { MigrationInterface, QueryRunner } from 'typeorm';
import { ulid } from 'ulid';

export class BackfillMailboxes1779418400608 implements MigrationInterface {
  name = 'BackfillMailboxes1779418400608';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const domain = process.env.SUPPORT_EMAIL_DOMAIN;
    if (!domain) return;

    const workspaces: { id: string; slug: string }[] = await queryRunner.query(
      `SELECT w.id, w.slug FROM workspaces w WHERE w.id NOT IN (SELECT "workspaceId" FROM mailboxes)`,
    );

    for (const ws of workspaces) {
      await queryRunner.query(
        `INSERT INTO mailboxes (id, address, "workspaceId", "isActive", "createdAt") VALUES ($1, $2, $3, true, NOW())`,
        [ulid(), `${ws.slug}@${domain}`, ws.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const domain = process.env.SUPPORT_EMAIL_DOMAIN;
    if (!domain) return;

    await queryRunner.query(
      `DELETE FROM mailboxes WHERE address LIKE $1`,
      [`%@${domain}`],
    );
  }
}
