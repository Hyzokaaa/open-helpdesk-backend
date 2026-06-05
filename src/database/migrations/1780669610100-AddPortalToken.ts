import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPortalToken1780669610100 implements MigrationInterface {
    name = 'AddPortalToken1780669610100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "portalToken" character varying`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "UQ_829124c96d36041da20e1be92ea" UNIQUE ("portalToken")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "UQ_829124c96d36041da20e1be92ea"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "portalToken"`);
    }

}
