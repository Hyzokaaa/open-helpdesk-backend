import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuthProvider1780764207672 implements MigrationInterface {
    name = 'AddAuthProvider1780764207672'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "authProvider" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "authProvider"`);
    }

}
