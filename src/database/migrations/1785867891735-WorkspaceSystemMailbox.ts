import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceSystemMailbox1785867891735 implements MigrationInterface {
    name = 'WorkspaceSystemMailbox1785867891735'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "systemMailboxEnabled" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "systemMailboxEnabled"`);
    }

}
