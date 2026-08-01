import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMailboxSyncDuration1785557088248 implements MigrationInterface {
    name = 'AddMailboxSyncDuration1785557088248'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "lastSyncDuration" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "lastSyncDuration"`);
    }

}
