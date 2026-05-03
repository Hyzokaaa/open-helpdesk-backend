import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLog1777737844220 implements MigrationInterface {
    name = 'AuditLog1777737844220'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_log_entries" ("id" character varying NOT NULL, "action" character varying NOT NULL, "entityType" character varying NOT NULL, "entityId" character varying NOT NULL, "userId" character varying NOT NULL, "workspaceId" character varying, "metadata" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4f2fbddaca7c6531577e79177a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cb4f309ac2faa29655ffaecd92" ON "audit_log_entries" ("entityType", "entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_550030d997bc49d758f1f07dec" ON "audit_log_entries" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb5a4a51fc9fec0512ff8629aa" ON "audit_log_entries" ("workspaceId", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ADD CONSTRAINT "FK_550030d997bc49d758f1f07dec2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ADD CONSTRAINT "FK_fc16b19595e9958416ca5384dcc" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_log_entries" DROP CONSTRAINT "FK_fc16b19595e9958416ca5384dcc"`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" DROP CONSTRAINT "FK_550030d997bc49d758f1f07dec2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb5a4a51fc9fec0512ff8629aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_550030d997bc49d758f1f07dec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb4f309ac2faa29655ffaecd92"`);
        await queryRunner.query(`DROP TABLE "audit_log_entries"`);
    }

}
