import { MigrationInterface, QueryRunner } from "typeorm";

export class MatrixNotices1793817422236 implements MigrationInterface {
    name = 'MatrixNotices1793817422236'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "matrix_ticket_threads" ("id" character varying NOT NULL, "ticketId" character varying NOT NULL, "roomId" character varying NOT NULL, "rootEventId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_37335c2ebafb644628e07fde595" UNIQUE ("ticketId", "roomId"), CONSTRAINT "PK_283e563138de4045b995f3929bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "matrix_rooms" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "roomId" character varying NOT NULL, "departmentId" character varying, "events" text array NOT NULL DEFAULT '{}', "includeText" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "lastError" text, "lastErrorAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ca4aa6bd042756b920cd6b23027" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d6306d712d34437423cff8cd7d" ON "matrix_rooms" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9ac83a11c1c53096333741564c" ON "matrix_rooms" ("roomId") `);
        await queryRunner.query(`CREATE TABLE "matrix_bots" ("id" character varying NOT NULL, "workspaceId" character varying, "homeserverUrl" character varying NOT NULL, "userId" character varying NOT NULL, "deviceId" character varying, "encryptedAccessToken" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9d7e044936c5b00f7df7958ad36" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bf5dfff616bbb8c6b9d2b0e6d5" ON "matrix_bots" ("workspaceId") `);
        await queryRunner.query(`ALTER TABLE "matrix_ticket_threads" ADD CONSTRAINT "FK_730b75b54cab004496b06b93b37" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" ADD CONSTRAINT "FK_d6306d712d34437423cff8cd7dd" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" ADD CONSTRAINT "FK_b60bc788cff769b1d81d6e02ed9" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matrix_bots" ADD CONSTRAINT "FK_bf5dfff616bbb8c6b9d2b0e6d5a" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matrix_bots" DROP CONSTRAINT "FK_bf5dfff616bbb8c6b9d2b0e6d5a"`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" DROP CONSTRAINT "FK_b60bc788cff769b1d81d6e02ed9"`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" DROP CONSTRAINT "FK_d6306d712d34437423cff8cd7dd"`);
        await queryRunner.query(`ALTER TABLE "matrix_ticket_threads" DROP CONSTRAINT "FK_730b75b54cab004496b06b93b37"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf5dfff616bbb8c6b9d2b0e6d5"`);
        await queryRunner.query(`DROP TABLE "matrix_bots"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ac83a11c1c53096333741564c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6306d712d34437423cff8cd7d"`);
        await queryRunner.query(`DROP TABLE "matrix_rooms"`);
        await queryRunner.query(`DROP TABLE "matrix_ticket_threads"`);
    }

}
