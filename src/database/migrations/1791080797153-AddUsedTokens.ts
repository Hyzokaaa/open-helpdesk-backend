import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsedTokens1791080797153 implements MigrationInterface {
    name = 'AddUsedTokens1791080797153'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "used_tokens" ("id" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_458fa7adde3ad63bc0ab2878609" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_used_tokens_expires_at" ON "used_tokens" ("expiresAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_used_tokens_expires_at"`);
        await queryRunner.query(`DROP TABLE "used_tokens"`);
    }

}
