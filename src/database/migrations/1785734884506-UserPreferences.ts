import { MigrationInterface, QueryRunner } from "typeorm";

export class UserPreferences1785734884506 implements MigrationInterface {
    name = 'UserPreferences1785734884506'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "dateFormat" character varying NOT NULL DEFAULT 'DD/MM/YYYY'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "timezone" character varying NOT NULL DEFAULT 'auto'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "timezone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "dateFormat"`);
    }

}
