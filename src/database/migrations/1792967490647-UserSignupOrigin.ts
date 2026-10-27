import { MigrationInterface, QueryRunner } from "typeorm";

export class UserSignupOrigin1792967490647 implements MigrationInterface {
    name = 'UserSignupOrigin1792967490647'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "signupMethod" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "signupSource" jsonb`);
        // Existing accounts: the method where it can be told, from the account or its sign-up audit entry.
        // Where they came from was never recorded, so their source stays empty
        await queryRunner.query(`UPDATE "users" SET "signupMethod" = 'reporter' WHERE "autoCreated" = true`);
        await queryRunner.query(`UPDATE "users" SET "signupMethod" = 'google' WHERE "signupMethod" IS NULL AND "authProvider" = 'google'`);
        await queryRunner.query(`
            UPDATE "users" u SET "signupMethod" = CASE WHEN a."metadata"->>'invitedToWorkspace' IS NOT NULL THEN 'invitation' ELSE 'signup' END
            FROM "audit_log_entries" a
            WHERE u."signupMethod" IS NULL AND a."action" = 'user-signed-up' AND a."entityType" = 'user' AND a."entityId" = u."id"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "signupSource"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "signupMethod"`);
    }

}
