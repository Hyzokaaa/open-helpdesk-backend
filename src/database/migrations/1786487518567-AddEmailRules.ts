import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailRules1786487518567 implements MigrationInterface {
    name = 'AddEmailRules1786487518567'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_rules" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "name" character varying NOT NULL, "position" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "mailboxIds" jsonb NOT NULL DEFAULT '[]', "conditions" jsonb NOT NULL DEFAULT '[]', "actions" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3c9e6ffcf457fbe903a216c1e79" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "email_rules" ADD CONSTRAINT "FK_b60d05c5a0b4c803f69a54ef225" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_rules" DROP CONSTRAINT "FK_b60d05c5a0b4c803f69a54ef225"`);
        await queryRunner.query(`DROP TABLE "email_rules"`);
    }

}
