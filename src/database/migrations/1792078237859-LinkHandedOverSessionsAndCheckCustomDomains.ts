import { MigrationInterface, QueryRunner } from "typeorm";

export class LinkHandedOverSessionsAndCheckCustomDomains1792078237859 implements MigrationInterface {
    name = 'LinkHandedOverSessionsAndCheckCustomDomains1792078237859'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "customDomainCheckFailures" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "customDomainFailingSince" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "rootSessionId" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_user_sessions_root" ON "user_sessions" ("rootSessionId") `);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_2a28a5d627cb62d8f0d00956971" FOREIGN KEY ("rootSessionId") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_2a28a5d627cb62d8f0d00956971"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_sessions_root"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "rootSessionId"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "customDomainFailingSince"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "customDomainCheckFailures"`);
    }

}
