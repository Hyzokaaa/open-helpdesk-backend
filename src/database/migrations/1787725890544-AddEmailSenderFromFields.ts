import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailSenderFromFields1787725890544 implements MigrationInterface {
    name = 'AddEmailSenderFromFields1787725890544'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_email_senders" ADD "fromName" character varying`);
        await queryRunner.query(`ALTER TABLE "workspace_email_senders" ADD "fromEmail" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_email_senders" DROP COLUMN "fromEmail"`);
        await queryRunner.query(`ALTER TABLE "workspace_email_senders" DROP COLUMN "fromName"`);
    }

}
