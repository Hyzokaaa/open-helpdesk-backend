import { MigrationInterface, QueryRunner } from "typeorm";

export class MentionNotificationPreferences1795062460568 implements MigrationInterface {
    name = 'MentionNotificationPreferences1795062460568'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "inAppMentioned" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "emailMentioned" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixMentioned" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixMentioned"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "emailMentioned"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "inAppMentioned"`);
    }

}
