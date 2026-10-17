import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailQuotes1792027632042 implements MigrationInterface {
    name = 'AddEmailQuotes1792027632042'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_quotes" ("id" character varying NOT NULL, "ticketId" character varying NOT NULL, "commentId" character varying, "content" text NOT NULL, "lineCount" integer NOT NULL, "method" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a32ccbab6e3587780e6b2b2f7a6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_email_quotes_description" ON "email_quotes" ("ticketId") WHERE "commentId" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_email_quotes_comment" ON "email_quotes" ("commentId") WHERE "commentId" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_email_quotes_ticket" ON "email_quotes" ("ticketId") `);
        await queryRunner.query(`ALTER TABLE "email_quotes" ADD CONSTRAINT "FK_8b852ecdd36191c46a4953e53a5" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "email_quotes" ADD CONSTRAINT "FK_c109d9c9e4f0a075237d5fbe216" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "email_quotes" DROP CONSTRAINT "FK_c109d9c9e4f0a075237d5fbe216"`);
        await queryRunner.query(`ALTER TABLE "email_quotes" DROP CONSTRAINT "FK_8b852ecdd36191c46a4953e53a5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_email_quotes_ticket"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_email_quotes_comment"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_email_quotes_description"`);
        await queryRunner.query(`DROP TABLE "email_quotes"`);
    }

}
