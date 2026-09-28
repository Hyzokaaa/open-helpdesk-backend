import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketUnassignedNotificationPreference1790613001296 implements MigrationInterface {
    name = 'AddTicketUnassignedNotificationPreference1790613001296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "inAppTicketUnassigned" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "inAppTicketUnassigned"`);
    }

}
