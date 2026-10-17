import { MigrationInterface, QueryRunner } from "typeorm";
import { ulid } from "ulid";

export class AddTicketPortalAccesses1792022900388 implements MigrationInterface {
    name = 'AddTicketPortalAccesses1792022900388'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ticket_portal_accesses" ("id" character varying NOT NULL, "ticketId" character varying NOT NULL, "userId" character varying NOT NULL, "token" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d17ffb6135fbb8d6b79807a2cca" UNIQUE ("token"), CONSTRAINT "UQ_a657780c2b3e5bffc6fab5fea28" UNIQUE ("ticketId", "userId"), CONSTRAINT "PK_4ec265871f76f384f9ece6f63a1" PRIMARY KEY ("id"))`);
        // Added by hand: the links already emailed keep working, as the reporter's link
        const linked: { id: string; reporterId: string; portalToken: string }[] = await queryRunner.query(
            `SELECT id, "reporterId", "portalToken" FROM "tickets" WHERE "portalToken" IS NOT NULL`,
        );
        for (const ticket of linked) {
            await queryRunner.query(
                `INSERT INTO "ticket_portal_accesses" ("id", "ticketId", "userId", "token") VALUES ($1, $2, $3, $4)`,
                [ulid(), ticket.id, ticket.reporterId, ticket.portalToken],
            );
        }
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "UQ_829124c96d36041da20e1be92ea"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "portalToken"`);
        await queryRunner.query(`ALTER TABLE "ticket_portal_accesses" ADD CONSTRAINT "FK_89e048d6c575e1a449db245345c" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_portal_accesses" ADD CONSTRAINT "FK_9428469fc62fb450dd88911fcb5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_portal_accesses" DROP CONSTRAINT "FK_9428469fc62fb450dd88911fcb5"`);
        await queryRunner.query(`ALTER TABLE "ticket_portal_accesses" DROP CONSTRAINT "FK_89e048d6c575e1a449db245345c"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "portalToken" character varying`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "UQ_829124c96d36041da20e1be92ea" UNIQUE ("portalToken")`);
        // Added by hand: the reporters' links go back to their tickets; other people's are lost
        await queryRunner.query(
            `UPDATE "tickets" t SET "portalToken" = a."token" FROM "ticket_portal_accesses" a WHERE a."ticketId" = t.id AND a."userId" = t."reporterId"`,
        );
        await queryRunner.query(`DROP TABLE "ticket_portal_accesses"`);
    }

}
