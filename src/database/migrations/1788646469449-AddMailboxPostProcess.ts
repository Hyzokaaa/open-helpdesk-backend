import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMailboxPostProcess1788646469449 implements MigrationInterface {
    name = 'AddMailboxPostProcess1788646469449'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "postProcessAction" character varying NOT NULL DEFAULT 'none'`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "postProcessFolder" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "postProcessFolder"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "postProcessAction"`);
    }

}
