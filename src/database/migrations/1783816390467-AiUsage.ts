import { MigrationInterface, QueryRunner } from "typeorm";

export class AiUsage1783816390467 implements MigrationInterface {
    name = 'AiUsage1783816390467'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ai_usage" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "month" character varying NOT NULL, "count" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_65365a0e6cf96fa47ea0537a9d8" UNIQUE ("workspaceId", "month"), CONSTRAINT "PK_3dddab3a15520a9c3eba859195d" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "ai_usage"`);
    }

}
