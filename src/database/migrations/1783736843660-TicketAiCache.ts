import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketAiCache1783736843660 implements MigrationInterface {
    name = 'TicketAiCache1783736843660'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "aiCache" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "aiCache"`);
    }

}
