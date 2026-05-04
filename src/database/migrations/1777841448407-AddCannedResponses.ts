import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCannedResponses1777841448407 implements MigrationInterface {
    name = 'AddCannedResponses1777841448407'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "canned_responses" ("id" character varying NOT NULL, "title" character varying NOT NULL, "content" text NOT NULL, "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1df87c74d99c463b1c7fb30dc14" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "canned_responses" ADD CONSTRAINT "FK_7150d3fb1053d4b08a4aa4d06e7" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "canned_responses" DROP CONSTRAINT "FK_7150d3fb1053d4b08a4aa4d06e7"`);
        await queryRunner.query(`DROP TABLE "canned_responses"`);
    }

}
