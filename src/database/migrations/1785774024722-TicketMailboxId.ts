import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketMailboxId1785774024722 implements MigrationInterface {
    name = 'TicketMailboxId1785774024722'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "mailboxId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "mailboxId"`);
    }

}
