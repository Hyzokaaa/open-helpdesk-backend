import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketParticipants1783610010086 implements MigrationInterface {
    name = 'TicketParticipants1783610010086'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ticket_participants" ("id" character varying NOT NULL, "ticketId" character varying NOT NULL, "userId" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'follower', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e8aa3c0170c2340a6cd624af72d" UNIQUE ("ticketId", "userId"), CONSTRAINT "PK_f30273daf5a3c9504e8944f26b1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ticket_participants" ADD CONSTRAINT "FK_a20f7c5d0fcd1f49cebd794c9b9" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_participants" ADD CONSTRAINT "FK_4e5f07696a97841345a25975a69" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_participants" DROP CONSTRAINT "FK_4e5f07696a97841345a25975a69"`);
        await queryRunner.query(`ALTER TABLE "ticket_participants" DROP CONSTRAINT "FK_a20f7c5d0fcd1f49cebd794c9b9"`);
        await queryRunner.query(`DROP TABLE "ticket_participants"`);
    }

}
