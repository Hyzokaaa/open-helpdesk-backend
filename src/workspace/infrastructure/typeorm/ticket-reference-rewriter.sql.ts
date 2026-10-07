import { DataSource } from 'typeorm';
import { TicketReferenceFormat, formatTicketReference } from '../../../ticket/domain/ticket-reference';
import { TicketReferenceRewriter } from '../../domain/ticket-reference-rewriter';

const BATCH = 5000;

/**
 * Rewrites the references in one transaction, under the lock ticket creation takes, so no ticket
 * is created meanwhile. They are cleared first: numbers are unique, so the new references are too,
 * but an old one could equal a new one mid-way and trip the unique index.
 */
export class SqlTicketReferenceRewriter implements TicketReferenceRewriter {
  constructor(private readonly dataSource: DataSource) {}

  async rewriteAll(workspaceId: string, format: TicketReferenceFormat): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [workspaceId]);
      await manager.query(`UPDATE tickets SET reference = NULL WHERE "workspaceId" = $1`, [workspaceId]);
      const rows: { id: string; ticketNumber: number }[] = await manager.query(
        `SELECT id, "ticketNumber" FROM tickets WHERE "workspaceId" = $1`, [workspaceId],
      );
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await manager.query(
          `UPDATE tickets AS t SET reference = v.reference
           FROM (SELECT unnest($1::varchar[]) AS id, unnest($2::varchar[]) AS reference) AS v
           WHERE t.id = v.id`,
          [batch.map((r) => r.id), batch.map((r) => formatTicketReference(Number(r.ticketNumber), format))],
        );
      }
      return rows.length;
    });
  }
}
