import { MigrationInterface, QueryRunner } from "typeorm";
import { formatTicketReference, ticketReferenceFormatOf } from "../../ticket/domain/ticket-reference";
import { WorkspaceTicketReference } from "../../workspace/domain/entities/workspace-ticket-reference";

const BATCH = 5000;

/**
 * Each ticket keeps the reference it was created with. Existing tickets get the one they show
 * today, computed with the same function the API used to format them on output, so nothing a
 * person already has (an email, a link, a note) changes.
 *
 * Runs outside a transaction, in batches, so a large tickets table is not held in one long
 * transaction; it is safe to rerun, since only tickets without a reference are touched. The
 * unique index comes in the next migration, built CONCURRENTLY.
 */
export class AddTicketReference1791382998329 implements MigrationInterface {
    name = 'AddTicketReference1791382998329'
    transaction = false

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "reference" character varying(40)`);

        const settings: { workspaceId: string; style: string; prefix: string; secret: string | null }[] = await queryRunner.query(
            `SELECT "workspaceId", style, prefix, secret FROM workspace_ticket_references`,
        );
        const formats = new Map(settings.map((s) => [s.workspaceId, ticketReferenceFormatOf(new WorkspaceTicketReference(s))]));

        for (;;) {
            const rows: { id: string; workspaceId: string; ticketNumber: number }[] = await queryRunner.query(
                `SELECT id, "workspaceId", "ticketNumber" FROM tickets WHERE reference IS NULL ORDER BY id LIMIT ${BATCH}`,
            );
            if (rows.length === 0) break;
            await queryRunner.query(
                `UPDATE tickets AS t SET reference = v.reference
                 FROM (SELECT unnest($1::varchar[]) AS id, unnest($2::varchar[]) AS reference) AS v
                 WHERE t.id = v.id`,
                [
                    rows.map((r) => r.id),
                    rows.map((r) => formatTicketReference(Number(r.ticketNumber), formats.get(r.workspaceId) ?? ticketReferenceFormatOf(null))),
                ],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "reference"`);
    }

}
