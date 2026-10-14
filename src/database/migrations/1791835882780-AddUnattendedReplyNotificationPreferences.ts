import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUnattendedReplyNotificationPreferences1791835882780 implements MigrationInterface {
    name = 'AddUnattendedReplyNotificationPreferences1791835882780'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "inAppUnattendedReply" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "emailUnattendedReply" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "emailUnattendedReply"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "inAppUnattendedReply"`);
    }

}
