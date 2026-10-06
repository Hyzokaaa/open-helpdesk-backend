import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSystemAnalyticsSettings1791246786394 implements MigrationInterface {
    name = 'AddSystemAnalyticsSettings1791246786394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "system_analytics_settings" ("id" character varying NOT NULL, "provider" character varying(20), "serverUrl" character varying(2048), "siteId" character varying(10), "useCookies" boolean NOT NULL DEFAULT false, "trackEvents" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_79ce8be8b23a54daed0944052ac" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "system_analytics_settings"`);
    }

}
