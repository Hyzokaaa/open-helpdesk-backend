import { MigrationInterface, QueryRunner } from "typeorm";

export class SmtpEncryption1785981158609 implements MigrationInterface {
    name = 'SmtpEncryption1785981158609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_email_senders" ADD "encryption" character varying NOT NULL DEFAULT 'tls'`);
        await queryRunner.query(`ALTER TABLE "system_email_settings" ADD "encryption" character varying NOT NULL DEFAULT 'tls'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "system_email_settings" DROP COLUMN "encryption"`);
        await queryRunner.query(`ALTER TABLE "workspace_email_senders" DROP COLUMN "encryption"`);
    }

}
