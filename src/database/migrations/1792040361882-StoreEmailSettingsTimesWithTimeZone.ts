import { MigrationInterface, QueryRunner } from "typeorm";

export class StoreEmailSettingsTimesWithTimeZone1792040361882 implements MigrationInterface {
    name = 'StoreEmailSettingsTimesWithTimeZone1792040361882'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "system_email_settings" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "system_email_settings" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "system_email_settings" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "system_email_settings" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "system_email_settings" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "system_email_settings" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "system_email_settings" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "system_email_settings" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

}
