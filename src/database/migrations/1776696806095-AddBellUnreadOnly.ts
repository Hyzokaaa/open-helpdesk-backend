import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBellUnreadOnly1776696806095 implements MigrationInterface {
    name = 'AddBellUnreadOnly1776696806095'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "bellUnreadOnly" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "bellUnreadOnly"`);
    }

}
