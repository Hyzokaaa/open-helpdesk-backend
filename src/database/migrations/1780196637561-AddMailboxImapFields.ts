import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMailboxImapFields1780196637561 implements MigrationInterface {
    name = 'AddMailboxImapFields1780196637561'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "type" character varying NOT NULL DEFAULT 'webhook'`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "imapHost" character varying`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "imapPort" integer`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "imapUser" character varying`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "imapPass" character varying`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "imapTls" boolean`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "imapFolder" character varying DEFAULT 'INBOX'`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "pollInterval" integer DEFAULT '30'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "pollInterval"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "imapFolder"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "imapTls"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "imapPass"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "imapUser"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "imapPort"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "imapHost"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "type"`);
    }

}
