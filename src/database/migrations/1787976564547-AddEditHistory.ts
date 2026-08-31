import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEditHistory1787976564547 implements MigrationInterface {
    name = 'AddEditHistory1787976564547'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ticket_description_edits" ("id" character varying NOT NULL, "content" text NOT NULL, "ticketId" character varying NOT NULL, "editedById" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9601a844801dea2db633c789aab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "comment_edits" ("id" character varying NOT NULL, "content" text NOT NULL, "commentId" character varying NOT NULL, "editedById" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_880623d6a48f949ad7bb15d6a02" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "descriptionEditedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "comments" ADD "editedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "ticket_description_edits" ADD CONSTRAINT "FK_051aa017538fb676311b6204901" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_description_edits" ADD CONSTRAINT "FK_1603fcff846d4a85707ccb6b5be" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment_edits" ADD CONSTRAINT "FK_8690cad93403b7dbd0f874b2e17" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment_edits" ADD CONSTRAINT "FK_a958bcd9b867234fda03bfec428" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comment_edits" DROP CONSTRAINT "FK_a958bcd9b867234fda03bfec428"`);
        await queryRunner.query(`ALTER TABLE "comment_edits" DROP CONSTRAINT "FK_8690cad93403b7dbd0f874b2e17"`);
        await queryRunner.query(`ALTER TABLE "ticket_description_edits" DROP CONSTRAINT "FK_1603fcff846d4a85707ccb6b5be"`);
        await queryRunner.query(`ALTER TABLE "ticket_description_edits" DROP CONSTRAINT "FK_051aa017538fb676311b6204901"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "editedAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "descriptionEditedAt"`);
        await queryRunner.query(`DROP TABLE "comment_edits"`);
        await queryRunner.query(`DROP TABLE "ticket_description_edits"`);
    }

}
