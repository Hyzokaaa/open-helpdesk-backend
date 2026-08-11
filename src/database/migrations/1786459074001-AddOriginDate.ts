import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOriginDate1786459074001 implements MigrationInterface {
    name = 'AddOriginDate1786459074001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "originDate" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "originDate"`);
    }

}
