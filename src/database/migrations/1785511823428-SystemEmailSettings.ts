import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemEmailSettings1785511823428 implements MigrationInterface {
    name = 'SystemEmailSettings1785511823428'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "system_email_settings" ("id" character varying NOT NULL, "smtpHost" character varying NOT NULL, "smtpPort" integer NOT NULL, "smtpUser" character varying NOT NULL, "smtpPass" character varying NOT NULL, "smtpFrom" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c5b4670ae40385be7ef761a0993" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "system_email_settings"`);
    }

}
