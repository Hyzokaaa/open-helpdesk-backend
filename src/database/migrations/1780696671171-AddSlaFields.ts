import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSlaFields1780696671171 implements MigrationInterface {
    name = 'AddSlaFields1780696671171'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "slaPolicy" jsonb`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "firstResponseAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "firstResponseBreached" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "resolutionBreached" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "resolutionBreached"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "firstResponseBreached"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "firstResponseAt"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "slaPolicy"`);
    }

}
