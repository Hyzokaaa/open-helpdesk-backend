import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspacePortalAccess1792348372657 implements MigrationInterface {
    name = 'WorkspacePortalAccess1792348372657'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "portalEnabled" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "publicKbEnabled" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "publicKbEnabled"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "portalEnabled"`);
    }

}
