import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOpenStatusAndTicketNumber1779138054858 implements MigrationInterface {
    name = 'AddOpenStatusAndTicketNumber1779138054858'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "ticketNumber" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`
            WITH numbered AS (
                SELECT id, "workspaceId",
                    ROW_NUMBER() OVER (PARTITION BY "workspaceId" ORDER BY "createdAt" ASC) as rn
                FROM tickets
            )
            UPDATE tickets SET "ticketNumber" = numbered.rn
            FROM numbered WHERE tickets.id = numbered.id
        `);
        await queryRunner.query(`UPDATE tickets SET status = 'open' WHERE status = 'pending' AND "assigneeId" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE tickets SET status = 'pending' WHERE status = 'open'`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "ticketNumber"`);
    }

}
