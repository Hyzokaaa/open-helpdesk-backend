import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCloseReason1778262473138 implements MigrationInterface {
    name = 'AddCloseReason1778262473138'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "closeReason" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "closeReason"`);
    }

}
