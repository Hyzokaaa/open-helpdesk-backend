import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemBranding1786914951569 implements MigrationInterface {
    name = 'SystemBranding1786914951569'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "system_branding" ("id" character varying NOT NULL, "appName" character varying(50), "appSubtitle" character varying(30), "logo" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_953afe15a0996d51a0ff14c49d9" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "system_branding"`);
    }

}
