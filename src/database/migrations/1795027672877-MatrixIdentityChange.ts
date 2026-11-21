import { MigrationInterface, QueryRunner } from "typeorm";

export class MatrixIdentityChange1795027672877 implements MigrationInterface {
    name = 'MatrixIdentityChange1795027672877'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matrix_identities" ADD "pendingMatrixUserId" character varying`);
        await queryRunner.query(`ALTER TABLE "matrix_identities" ADD "pendingBotId" character varying`);
        await queryRunner.query(`ALTER TABLE "matrix_identities" ADD "pendingRoomId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matrix_identities" DROP COLUMN "pendingRoomId"`);
        await queryRunner.query(`ALTER TABLE "matrix_identities" DROP COLUMN "pendingBotId"`);
        await queryRunner.query(`ALTER TABLE "matrix_identities" DROP COLUMN "pendingMatrixUserId"`);
    }

}
