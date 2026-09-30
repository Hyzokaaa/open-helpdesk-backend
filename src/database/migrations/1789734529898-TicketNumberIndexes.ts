import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketNumberIndexes1789734529898 implements MigrationInterface {
    name = 'TicketNumberIndexes1789734529898'

    // CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and the
    // tickets table is large enough that locking it out for writes is not an
    // option.
    transaction = false

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ticket numbers have only ever been kept unique by the application, so
        // a collision predating this index would make it fail to build. Repair
        // the duplicates first: only the extra copies move, every other ticket
        // keeps the number its reporter already knows.
        await queryRunner.query(`
            WITH duplicated AS (
                SELECT id,
                       "workspaceId",
                       ROW_NUMBER() OVER (
                           PARTITION BY "workspaceId", "ticketNumber"
                           ORDER BY "createdAt" ASC NULLS LAST, id
                       ) AS copy
                FROM tickets
            ),
            reassigned AS (
                SELECT d.id,
                       (
                           SELECT MAX(t."ticketNumber")
                           FROM tickets t
                           WHERE t."workspaceId" = d."workspaceId"
                       ) + ROW_NUMBER() OVER (
                           PARTITION BY d."workspaceId" ORDER BY d.id
                       ) AS "ticketNumber"
                FROM duplicated d
                WHERE d.copy > 1
            )
            UPDATE tickets
            SET "ticketNumber" = reassigned."ticketNumber"
            FROM reassigned
            WHERE tickets.id = reassigned.id
        `);
        await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_tickets_workspace_created_at" ON "tickets" ("workspaceId", "createdAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_tickets_workspace_number" ON "tickets" ("workspaceId", "ticketNumber") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_tickets_workspace_number"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_tickets_workspace_created_at"`);
    }

}
