import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A reference is unique within its workspace. tickets can be large, so the index is built
 * CONCURRENTLY, which cannot run inside a transaction (allowed by migrationsTransactionMode "each").
 */
export class AddTicketReferenceIndex1791382998330 implements MigrationInterface {
    name = 'AddTicketReferenceIndex1791382998330'
    transaction = false

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_tickets_workspace_reference" ON "tickets" ("workspaceId", "reference")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_tickets_workspace_reference"`);
    }

}
