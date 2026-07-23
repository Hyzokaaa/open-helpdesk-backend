import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransferRequests1784741017754 implements MigrationInterface {
    name = 'AddTransferRequests1784741017754'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "transfer_requests" ("id" character varying NOT NULL, "ticketId" character varying NOT NULL, "requesterId" character varying NOT NULL, "targetUserId" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "resolvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f97530bf47e4af43166089627ba" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" ADD CONSTRAINT "FK_db8de81e4ee9cde43406b9ed1b1" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" ADD CONSTRAINT "FK_bbbe8e3be48670a8c6ff7def305" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" ADD CONSTRAINT "FK_409683e7a1507b58e4ca418189c" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_transfer_requests_pending_ticket" ON "transfer_requests" ("ticketId") WHERE "status" = 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transfer_requests" DROP CONSTRAINT "FK_409683e7a1507b58e4ca418189c"`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" DROP CONSTRAINT "FK_bbbe8e3be48670a8c6ff7def305"`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" DROP CONSTRAINT "FK_db8de81e4ee9cde43406b9ed1b1"`);
        await queryRunner.query(`DROP INDEX "UQ_transfer_requests_pending_ticket"`);
        await queryRunner.query(`DROP TABLE "transfer_requests"`);
    }

}
