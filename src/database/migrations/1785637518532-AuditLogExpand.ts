import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLogExpand1785637518532 implements MigrationInterface {
    name = 'AuditLogExpand1785637518532'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_transfer_requests_pending_ticket"`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ADD "category" character varying NOT NULL DEFAULT 'ticket'`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ADD "level" character varying NOT NULL DEFAULT 'info'`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ADD "source" character varying`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" DROP CONSTRAINT "FK_550030d997bc49d758f1f07dec2"`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_0a2511ab6187b9f880c293f60f" ON "audit_log_entries" ("level") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff70f0ac12ced26c627662c4dc" ON "audit_log_entries" ("category") `);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ADD CONSTRAINT "FK_550030d997bc49d758f1f07dec2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_log_entries" DROP CONSTRAINT "FK_550030d997bc49d758f1f07dec2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff70f0ac12ced26c627662c4dc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0a2511ab6187b9f880c293f60f"`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ADD CONSTRAINT "FK_550030d997bc49d758f1f07dec2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" DROP COLUMN "source"`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" DROP COLUMN "level"`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" DROP COLUMN "category"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_transfer_requests_pending_ticket" ON "transfer_requests" ("ticketId") WHERE ((status)::text = 'pending'::text)`);
    }

}
