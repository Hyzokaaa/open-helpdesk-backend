import { MigrationInterface, QueryRunner } from "typeorm";

export class OrganizationNotes1787357279817 implements MigrationInterface {
    name = 'OrganizationNotes1787357279817'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organizations" ADD "notes" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "notes"`);
    }

}
