import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceSoftDelete1791352780457 implements MigrationInterface {
    name = 'AddWorkspaceSoftDelete1791352780457'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Audit entries keep the id of their workspace after it is purged, so the foreign key goes
        await queryRunner.query(`ALTER TABLE "audit_log_entries" DROP CONSTRAINT IF EXISTS "FK_fc16b19595e9958416ca5384dcc"`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "deletedById" character varying`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "purgeAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "purgeReminderSentAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_workspaces_purge_at" ON "workspaces" ("purgeAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_workspaces_purge_at"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "purgeReminderSentAt"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "purgeAt"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "deletedById"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "deletedAt"`);
        // Entries of workspaces purged meanwhile point nowhere; the restored key would reject them
        await queryRunner.query(`UPDATE "audit_log_entries" SET "workspaceId" = NULL WHERE "workspaceId" IS NOT NULL AND "workspaceId" NOT IN (SELECT "id" FROM "workspaces")`);
        await queryRunner.query(`ALTER TABLE "audit_log_entries" ADD CONSTRAINT "FK_fc16b19595e9958416ca5384dcc" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
