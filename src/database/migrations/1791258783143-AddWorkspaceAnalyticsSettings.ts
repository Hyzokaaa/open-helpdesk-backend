import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceAnalyticsSettings1791258783143 implements MigrationInterface {
    name = 'AddWorkspaceAnalyticsSettings1791258783143'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_analytics_settings" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "provider" character varying(20), "serverUrl" character varying(2048), "siteId" character varying(10), "useCookies" boolean NOT NULL DEFAULT false, "trackEvents" boolean NOT NULL DEFAULT true, "shareWithInstallation" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ad685e5f26f23e02d1f58191bd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_workspace_analytics_settings_workspace" ON "workspace_analytics_settings" ("workspaceId") `);
        await queryRunner.query(`ALTER TABLE "workspace_analytics_settings" ADD CONSTRAINT "FK_f5c819361452ff5e62b18477929" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_analytics_settings" DROP CONSTRAINT "FK_f5c819361452ff5e62b18477929"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_workspace_analytics_settings_workspace"`);
        await queryRunner.query(`DROP TABLE "workspace_analytics_settings"`);
    }

}
