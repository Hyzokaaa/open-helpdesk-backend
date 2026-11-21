import { MigrationInterface, QueryRunner } from "typeorm";

export class MatrixRoomScopes1794002172982 implements MigrationInterface {
    name = 'MatrixRoomScopes1794002172982'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matrix_rooms" ADD "projectId" character varying`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" ADD "organizationId" character varying`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" ADD "onlyTicketsWithoutOtherRoom" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" ADD CONSTRAINT "FK_a57d05597b3d34d9a0a2783e9b3" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" ADD CONSTRAINT "FK_cbe8fca0dfe60730c4632633c1b" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matrix_rooms" DROP CONSTRAINT "FK_cbe8fca0dfe60730c4632633c1b"`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" DROP CONSTRAINT "FK_a57d05597b3d34d9a0a2783e9b3"`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" DROP COLUMN "onlyTicketsWithoutOtherRoom"`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" DROP COLUMN "organizationId"`);
        await queryRunner.query(`ALTER TABLE "matrix_rooms" DROP COLUMN "projectId"`);
    }

}
