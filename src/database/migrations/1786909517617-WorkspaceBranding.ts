import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceBranding1786909517617 implements MigrationInterface {
    name = 'WorkspaceBranding1786909517617'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "appName" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "appSubtitle" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "logo" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "logo"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "appSubtitle"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "appName"`);
    }

}
