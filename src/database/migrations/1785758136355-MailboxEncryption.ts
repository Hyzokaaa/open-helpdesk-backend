import { MigrationInterface, QueryRunner } from "typeorm";

export class MailboxEncryption1785758136355 implements MigrationInterface {
    name = 'MailboxEncryption1785758136355'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "encryption" character varying NOT NULL DEFAULT 'tls'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "encryption"`);
    }

}
