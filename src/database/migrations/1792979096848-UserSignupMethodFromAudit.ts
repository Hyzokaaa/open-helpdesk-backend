import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Existing accounts the first backfill (UserSignupOrigin) could not tell, from their user-created
 * audit entry: a first Google sign-in, whose authProvider was never stored, and accounts a person
 * created by hand, whose entry has that person as author and is not marked autoCreated.
 */
export class UserSignupMethodFromAudit1792979096848 implements MigrationInterface {
    name = 'UserSignupMethodFromAudit1792979096848'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "users" u SET "signupMethod" = 'google'
            FROM "audit_log_entries" a
            WHERE u."signupMethod" IS NULL AND a."action" = 'user-created' AND a."entityType" = 'user' AND a."entityId" = u."id"
              AND a."metadata"->>'via' = 'oauth'
        `);
        await queryRunner.query(`
            UPDATE "users" u SET "signupMethod" = 'admin'
            FROM "audit_log_entries" a
            WHERE u."signupMethod" IS NULL AND a."action" = 'user-created' AND a."entityType" = 'user' AND a."entityId" = u."id"
              AND a."metadata"->>'autoCreated' IS DISTINCT FROM 'true'
              AND a."userId" IS NOT NULL AND a."userId" <> u."id"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "users" u SET "signupMethod" = NULL
            FROM "audit_log_entries" a
            WHERE a."action" = 'user-created' AND a."entityType" = 'user' AND a."entityId" = u."id" AND (
              (u."signupMethod" = 'google' AND a."metadata"->>'via' = 'oauth' AND u."authProvider" IS DISTINCT FROM 'google')
              OR (u."signupMethod" = 'admin' AND a."metadata"->>'autoCreated' IS DISTINCT FROM 'true' AND a."userId" IS NOT NULL AND a."userId" <> u."id")
            )
        `);
    }

}
