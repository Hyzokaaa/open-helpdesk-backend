import { MigrationInterface, QueryRunner } from "typeorm";

export class UpgradeNotificationSettings1788134252805 implements MigrationInterface {
    name = 'UpgradeNotificationSettings1788134252805'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "system_notification_settings_model" ("id" character varying NOT NULL, "upgradeEnabled" boolean NOT NULL DEFAULT true, "upgradeEmail" boolean NOT NULL DEFAULT true, "upgradeInApp" boolean NOT NULL DEFAULT true, "lastNotifiedVersion" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b210fcc3b880b2cc5aee996f5e5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "emailUpgradeAvailable" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "inAppUpgradeAvailable" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "inAppUpgradeAvailable"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "emailUpgradeAvailable"`);
        await queryRunner.query(`DROP TABLE "system_notification_settings_model"`);
    }

}
