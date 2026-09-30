import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSessions1790686102781 implements MigrationInterface {
    name = 'AddUserSessions1790686102781'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_sessions" ("id" character varying NOT NULL, "userId" character varying NOT NULL, "tokenHash" character varying NOT NULL, "previousTokenHash" character varying, "rotatedAt" TIMESTAMP WITH TIME ZONE, "rememberMe" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "revokedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_user_sessions_user" ON "user_sessions" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_sessions_previous_token_hash" ON "user_sessions" ("previousTokenHash") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_user_sessions_token_hash" ON "user_sessions" ("tokenHash") `);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_55fa4db8406ed66bc7044328427" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_55fa4db8406ed66bc7044328427"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_sessions_token_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_sessions_previous_token_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_sessions_user"`);
        await queryRunner.query(`DROP TABLE "user_sessions"`);
    }

}
