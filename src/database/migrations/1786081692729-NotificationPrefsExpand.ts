import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationPrefsExpand1786081692729 implements MigrationInterface {
    name = 'NotificationPrefsExpand1786081692729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "emailCsatSurvey" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "emailTransferRequest" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "inAppTransferRequest" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "inAppTransferRequest"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "emailTransferRequest"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "emailCsatSurvey"`);
    }

}
