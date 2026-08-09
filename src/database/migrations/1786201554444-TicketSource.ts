import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketSource1786201554444 implements MigrationInterface {
    name = 'TicketSource1786201554444'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "source" character varying NOT NULL DEFAULT 'ui'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "source"`);
    }

}
