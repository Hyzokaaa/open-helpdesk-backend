import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveMailboxAddressUnique1786575907673 implements MigrationInterface {
    name = 'RemoveMailboxAddressUnique1786575907673'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP CONSTRAINT "UQ_288e74dca7ea13e221670cea1b4"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD CONSTRAINT "UQ_288e74dca7ea13e221670cea1b4" UNIQUE ("address")`);
    }

}
