import { MigrationInterface, QueryRunner } from "typeorm";

export class MarkProcessedEmailsPerMailbox1791569916555 implements MigrationInterface {
    name = 'MarkProcessedEmailsPerMailbox1791569916555'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Marks that existed already had no mailbox: '*' keeps them valid for every mailbox, so no mailbox
        // takes an old message for a new one. A constant default is a catalog change, not a table rewrite.
        await queryRunner.query(`ALTER TABLE "processed_emails" ADD "mailboxId" character varying NOT NULL DEFAULT '*'`);
        await queryRunner.query(`ALTER TABLE "processed_emails" ALTER COLUMN "mailboxId" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "processed_emails" DROP CONSTRAINT "PK_457651d9ca86541caefc2d1162c"`);
        await queryRunner.query(`ALTER TABLE "processed_emails" ADD CONSTRAINT "PK_c1ade5567f397931669be450a22" PRIMARY KEY ("messageId", "mailboxId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "processed_emails" DROP CONSTRAINT "PK_c1ade5567f397931669be450a22"`);
        // One row per message again before the single-column key comes back
        await queryRunner.query(`DELETE FROM "processed_emails" a USING "processed_emails" b WHERE a."messageId" = b."messageId" AND a."mailboxId" > b."mailboxId"`);
        await queryRunner.query(`ALTER TABLE "processed_emails" ADD CONSTRAINT "PK_457651d9ca86541caefc2d1162c" PRIMARY KEY ("messageId")`);
        await queryRunner.query(`ALTER TABLE "processed_emails" DROP COLUMN "mailboxId"`);
    }

}
