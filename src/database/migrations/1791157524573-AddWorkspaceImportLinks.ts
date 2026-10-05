import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceImportLinks1791157524573 implements MigrationInterface {
    name = 'AddWorkspaceImportLinks1791157524573'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_import_links" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "entityType" character varying(40) NOT NULL, "sourceId" character varying(26) NOT NULL, "targetId" character varying(26) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d094e70c4264cfa6d9b6c205817" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_workspace_import_links_target" ON "workspace_import_links" ("workspaceId", "entityType", "targetId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_workspace_import_links_source" ON "workspace_import_links" ("workspaceId", "entityType", "sourceId") `);
        await queryRunner.query(`ALTER TABLE "workspace_import_links" ADD CONSTRAINT "FK_37df820fc6704998cd5d11484af" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_import_links" DROP CONSTRAINT "FK_37df820fc6704998cd5d11484af"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_workspace_import_links_source"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_workspace_import_links_target"`);
        await queryRunner.query(`DROP TABLE "workspace_import_links"`);
    }

}
