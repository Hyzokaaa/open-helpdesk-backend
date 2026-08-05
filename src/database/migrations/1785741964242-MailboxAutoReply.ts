import { MigrationInterface, QueryRunner } from "typeorm";

export class MailboxAutoReply1785741964242 implements MigrationInterface {
    name = 'MailboxAutoReply1785741964242'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "autoReply" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "autoReply"`);
    }

}
