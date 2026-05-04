import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomFields1777899262426 implements MigrationInterface {
    name = 'AddCustomFields1777899262426'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "custom_field_definitions" ("id" character varying NOT NULL, "name" character varying NOT NULL, "type" character varying NOT NULL, "options" jsonb, "position" integer NOT NULL DEFAULT '0', "required" boolean NOT NULL DEFAULT false, "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_91f4cf6416f7aeb02c217005cb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "customFields" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "FK_d713a30103928b6bf8790e938f7" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_field_definitions" DROP CONSTRAINT "FK_d713a30103928b6bf8790e938f7"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "customFields"`);
        await queryRunner.query(`DROP TABLE "custom_field_definitions"`);
    }

}
