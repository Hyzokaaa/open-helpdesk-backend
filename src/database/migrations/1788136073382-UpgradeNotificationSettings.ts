import { MigrationInterface, QueryRunner } from "typeorm";

export class UpgradeNotificationSettings1788136073382 implements MigrationInterface {
    name = 'UpgradeNotificationSettings1788136073382'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "system_notification_settings" ("id" character varying NOT NULL, "upgradeEnabled" boolean NOT NULL DEFAULT true, "upgradeEmail" boolean NOT NULL DEFAULT true, "upgradeInApp" boolean NOT NULL DEFAULT true, "lastNotifiedVersion" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_849aac4dfa9f5a465919d0e7878" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "emailUpgradeAvailable" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "inAppUpgradeAvailable" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "inAppUpgradeAvailable"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "emailUpgradeAvailable"`);
        await queryRunner.query(`DROP TABLE "system_notification_settings"`);
    }

}
