import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceCreationSettings1790900166600 implements MigrationInterface {
    name = 'AddWorkspaceCreationSettings1790900166600'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_creation_settings" ("id" character varying NOT NULL, "selfService" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f913333dd445e7b6c5f60763950" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "workspace_creation_settings"`);
    }

}
