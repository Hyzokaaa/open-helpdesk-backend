import { MigrationInterface, QueryRunner } from "typeorm";

export class NoticeKinds1795103289365 implements MigrationInterface {
    name = 'NoticeKinds1795103289365'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notice_preferences" ("id" character varying NOT NULL, "userId" character varying NOT NULL, "kind" character varying NOT NULL, "channel" character varying NOT NULL, "enabled" boolean NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e4117a2d1e1a2b5fe571d3ad227" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1f6fa9036cd3c7d8e29aca2180" ON "notice_preferences" ("userId", "kind", "channel") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "link" character varying`);
        await queryRunner.query(`ALTER TABLE "notice_preferences" ADD CONSTRAINT "FK_e3c530e576b2c2b1e6f74b54148" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notice_preferences" DROP CONSTRAINT "FK_e3c530e576b2c2b1e6f74b54148"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "link"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f6fa9036cd3c7d8e29aca2180"`);
        await queryRunner.query(`DROP TABLE "notice_preferences"`);
    }

}
