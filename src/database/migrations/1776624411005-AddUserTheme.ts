import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserTheme1776624411005 implements MigrationInterface {
    name = 'AddUserTheme1776624411005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "theme" character varying NOT NULL DEFAULT 'system'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "theme"`);
    }

}
