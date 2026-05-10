import { MigrationInterface, QueryRunner } from "typeorm";

export class FixResolvedAtTimezone1778382594384 implements MigrationInterface {
    name = 'FixResolvedAtTimezone1778382594384'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "resolvedAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "resolvedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "resolvedAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "resolvedAt" TIMESTAMP`);
    }

}
