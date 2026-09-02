import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceIcon1788373153642 implements MigrationInterface {
    name = 'AddWorkspaceIcon1788373153642'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "icon" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "icon"`);
    }

}
