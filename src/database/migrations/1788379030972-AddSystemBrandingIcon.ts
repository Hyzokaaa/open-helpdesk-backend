import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSystemBrandingIcon1788379030972 implements MigrationInterface {
    name = 'AddSystemBrandingIcon1788379030972'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "system_branding" ADD "icon" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "system_branding" DROP COLUMN "icon"`);
    }

}
