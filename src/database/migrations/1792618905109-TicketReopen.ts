import { MigrationInterface, QueryRunner } from "typeorm";

export class TicketReopen1792618905109 implements MigrationInterface {
    name = 'TicketReopen1792618905109'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "firstResolvedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "reopenCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "lastReopen" jsonb`);
        // Tickets resolved before: their current resolution is the first one known
        await queryRunner.query(`UPDATE "tickets" SET "firstResolvedAt" = "resolvedAt" WHERE "resolvedAt" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "lastReopen"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "reopenCount"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "firstResolvedAt"`);
    }

}
