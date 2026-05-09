import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameClosedToDiscarded1778296431121 implements MigrationInterface {
    name = 'RenameClosedToDiscarded1778296431121'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" RENAME COLUMN "closeReason" TO "discardReason"`);
        await queryRunner.query(`UPDATE "tickets" SET "status" = 'discarded' WHERE "status" = 'closed'`);
        await queryRunner.query(`UPDATE "tickets" SET "discardReason" = NULL WHERE "discardReason" = 'resolved'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "tickets" SET "status" = 'closed' WHERE "status" = 'discarded'`);
        await queryRunner.query(`ALTER TABLE "tickets" RENAME COLUMN "discardReason" TO "closeReason"`);
    }

}
