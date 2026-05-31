import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMailboxSyncStatus1780234452778 implements MigrationInterface {
    name = 'AddMailboxSyncStatus1780234452778'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "lastSyncAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "lastError" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "lastError"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "lastSyncAt"`);
    }

}
