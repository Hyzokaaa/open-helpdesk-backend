import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMailboxAndAutoCreated1779418400607 implements MigrationInterface {
    name = 'AddMailboxAndAutoCreated1779418400607'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "mailboxes" ("id" character varying NOT NULL, "address" character varying NOT NULL, "workspaceId" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_288e74dca7ea13e221670cea1b4" UNIQUE ("address"), CONSTRAINT "PK_1471bf7ef6d7f1279fbbdf89a1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "autoCreated" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD CONSTRAINT "FK_0a6b093ccb7700e3c2c68a0f536" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP CONSTRAINT "FK_0a6b093ccb7700e3c2c68a0f536"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "autoCreated"`);
        await queryRunner.query(`DROP TABLE "mailboxes"`);
    }

}
