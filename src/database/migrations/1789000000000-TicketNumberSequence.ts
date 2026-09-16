import { MigrationInterface, QueryRunner } from 'typeorm';

export class TicketNumberSequence1789000000000 implements MigrationInterface {
  name = 'TicketNumberSequence1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove the old numeric default before changing the column type.
    await queryRunner.query(`
      ALTER TABLE "tickets" ALTER COLUMN "ticketNumber" DROP DEFAULT
    `);
    // Store ticket numbers as text so they can include the TK prefix.
    await queryRunner.query(`
      ALTER TABLE "tickets"
      ALTER COLUMN "ticketNumber" TYPE varchar
      USING "ticketNumber"::text
    `);
    // Give existing tickets a unique global number in creation order.
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC NULLS LAST, id) AS rn
        FROM tickets
      )
      UPDATE tickets
      SET "ticketNumber" = 'TK' || LPAD(numbered.rn::text, 6, '0')
      FROM numbered
      WHERE tickets.id = numbered.id
    `);
    // Use a database sequence to generate numbers safely under concurrency.
    await queryRunner.query(`CREATE SEQUENCE "ticket_number_seq"`);
    // Continue the sequence after the last existing ticket.
    await queryRunner.query(`
      SELECT setval(
        'ticket_number_seq',
        GREATEST((SELECT COUNT(*) FROM tickets), 1),
        (SELECT COUNT(*) FROM tickets) > 0
      )
    `);
    // Every ticket must have a number and no two tickets may share one.
    await queryRunner.query(`
      ALTER TABLE "tickets" ALTER COLUMN "ticketNumber" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_tickets_ticket_number_unique"
      ON "tickets" ("ticketNumber")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the unique constraint and sequence before restoring the old type.
    await queryRunner.query(`DROP INDEX "IDX_tickets_ticket_number_unique"`);
    await queryRunner.query(`DROP SEQUENCE "ticket_number_seq"`);
    await queryRunner.query(`
      ALTER TABLE "tickets"
      ALTER COLUMN "ticketNumber" TYPE integer
      USING SUBSTRING("ticketNumber" FROM 3)::integer
    `);
  }
}