import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceDealerIdWithMetadata1776720416868 implements MigrationInterface {
    name = 'ReplaceDealerIdWithMetadata1776720416868'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" RENAME COLUMN "dealerId" TO "metadata"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "metadata"`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "metadata" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "metadata"`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "metadata" character varying`);
        await queryRunner.query(`ALTER TABLE "workspaces" RENAME COLUMN "metadata" TO "dealerId"`);
    }

}
