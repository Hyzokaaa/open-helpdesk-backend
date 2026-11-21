import { MigrationInterface, QueryRunner } from "typeorm";

export class MatrixRoomIncludeFiles1793915948675 implements MigrationInterface {
    name = 'MatrixRoomIncludeFiles1793915948675'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matrix_rooms" ADD "includeFiles" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matrix_rooms" DROP COLUMN "includeFiles"`);
    }

}
