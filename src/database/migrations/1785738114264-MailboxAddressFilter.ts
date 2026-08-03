import { MigrationInterface, QueryRunner } from "typeorm";

export class MailboxAddressFilter1785738114264 implements MigrationInterface {
    name = 'MailboxAddressFilter1785738114264'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "addressMode" character varying NOT NULL DEFAULT 'address'`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "acceptedAddresses" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "acceptedAddresses"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "addressMode"`);
    }

}
