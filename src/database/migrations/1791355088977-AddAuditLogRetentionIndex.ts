import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The index the audit retention deletes by. audit_log_entries can be large, so it is built
 * CONCURRENTLY, which cannot run inside a transaction (allowed by migrationsTransactionMode "each").
 */
export class AddAuditLogRetentionIndex1791355088977 implements MigrationInterface {
    name = 'AddAuditLogRetentionIndex1791355088977'
    transaction = false

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_audit_log_category_created" ON "audit_log_entries" ("category", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_audit_log_category_created"`);
    }

}
