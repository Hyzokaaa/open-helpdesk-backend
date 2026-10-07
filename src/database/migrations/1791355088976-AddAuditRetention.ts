import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditRetention1791355088976 implements MigrationInterface {
    name = 'AddAuditRetention1791355088976'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_audit_retention" ("workspaceId" character varying NOT NULL, "days" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_02039f2abf72ef1c1e85e0e857f" PRIMARY KEY ("workspaceId"))`);
        await queryRunner.query(`CREATE TABLE "audit_retention_settings" ("id" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "days" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2f095d70157b6503478c3a45016" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "workspace_audit_retention" ADD CONSTRAINT "FK_02039f2abf72ef1c1e85e0e857f" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_audit_retention" DROP CONSTRAINT "FK_02039f2abf72ef1c1e85e0e857f"`);
        await queryRunner.query(`DROP TABLE "audit_retention_settings"`);
        await queryRunner.query(`DROP TABLE "workspace_audit_retention"`);
    }

}
