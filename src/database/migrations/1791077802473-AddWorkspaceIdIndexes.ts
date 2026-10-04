import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceIdIndexes1791077802473 implements MigrationInterface {
    name = 'AddWorkspaceIdIndexes1791077802473'

    // Every tenant-scoped table is filtered by "workspaceId" on each request,
    // and until now only tickets, audit_log_entries and the tables with a
    // (workspaceId, ...) unique constraint had an index that covered it.
    //
    // CREATE INDEX CONCURRENTLY cannot run inside a transaction block. Both
    // TypeORM configs use migrationsTransactionMode "each", which is what makes
    // this per-migration override legal.
    transaction = false

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_api_keys_workspace" ON "api_keys" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_canned_responses_workspace" ON "canned_responses" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_csat_responses_workspace" ON "csat_responses" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_custom_field_definitions_workspace" ON "custom_field_definitions" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_departments_workspace" ON "departments" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_email_rules_workspace" ON "email_rules" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_mailboxes_workspace" ON "mailboxes" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_organizations_workspace" ON "organizations" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_projects_workspace" ON "projects" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_ticket_categories_workspace" ON "ticket_categories" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_tags_workspace" ON "tags" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_webhooks_workspace" ON "webhooks" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_workspace_invitations_workspace" ON "workspace_invitations" ("workspaceId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // undoLastMigration ignores the per-migration transaction flag, so
        // CONCURRENTLY is not available here. Dropping an index is catalog
        // work and the lock is momentary.
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_workspace_invitations_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_webhooks_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_tags_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_ticket_categories_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_projects_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_organizations_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_mailboxes_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_email_rules_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_departments_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_custom_field_definitions_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_csat_responses_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_canned_responses_workspace"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_api_keys_workspace"`);
    }

}
