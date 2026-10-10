import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInvitationExpiryNotice1791568311863 implements MigrationInterface {
    name = 'AddInvitationExpiryNotice1791568311863'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_invitations" ADD "expiryNotifiedAt" TIMESTAMP WITH TIME ZONE`);
        // Invitations that expired before this release were never announced: mark them, so the first
        // hourly run does not flood their inviters with old news. Only those rows are touched.
        await queryRunner.query(`UPDATE "workspace_invitations" SET "expiryNotifiedAt" = "expiresAt" WHERE "status" = 'pending' AND "expiresAt" <= now() AND "expiryNotifiedAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "inAppInvitationExpired" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "inAppInvitationExpired"`);
        await queryRunner.query(`ALTER TABLE "workspace_invitations" DROP COLUMN "expiryNotifiedAt"`);
    }

}
