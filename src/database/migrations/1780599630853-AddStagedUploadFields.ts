import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStagedUploadFields1780599630853 implements MigrationInterface {
    name = 'AddStagedUploadFields1780599630853'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" ADD "token" character varying`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD "stagedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP COLUMN "stagedAt"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP COLUMN "token"`);
    }

}
