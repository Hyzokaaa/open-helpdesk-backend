import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAvatarKey1789010764288 implements MigrationInterface {
    name = 'AddUserAvatarKey1789010764288'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "avatarKey" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarKey"`);
    }

}
