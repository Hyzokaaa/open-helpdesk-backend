import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerified1777075951906 implements MigrationInterface {
    name = 'AddEmailVerified1777075951906'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "isEmailVerified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`UPDATE "users" SET "isEmailVerified" = true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isEmailVerified"`);
    }

}
