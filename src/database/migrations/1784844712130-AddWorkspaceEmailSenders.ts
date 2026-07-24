import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceEmailSenders1784844712130 implements MigrationInterface {
    name = 'AddWorkspaceEmailSenders1784844712130'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_email_senders" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "smtpHost" character varying NOT NULL, "smtpPort" integer NOT NULL, "smtpUser" character varying NOT NULL, "smtpPass" character varying NOT NULL, "smtpFrom" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_66e1ac1e294e058d2b121af03b9" UNIQUE ("workspaceId"), CONSTRAINT "PK_3dd40de9c6c0cb26f6b5e9df280" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "workspace_email_senders" ADD CONSTRAINT "FK_66e1ac1e294e058d2b121af03b9" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_email_senders" DROP CONSTRAINT "FK_66e1ac1e294e058d2b121af03b9"`);
        await queryRunner.query(`DROP TABLE "workspace_email_senders"`);
    }

}
