import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketRegisteredBy1786138632181 implements MigrationInterface {
    name = 'TicketRegisteredBy1786138632181'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "registeredById" character varying`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_7bd42de917a5ae3a851d845103e" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_7bd42de917a5ae3a851d845103e"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "registeredById"`);
    }

}
