import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcessedEmails1780188867016 implements MigrationInterface {
    name = 'AddProcessedEmails1780188867016'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "processed_emails" ("messageId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_457651d9ca86541caefc2d1162c" PRIMARY KEY ("messageId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "processed_emails"`);
    }

}
