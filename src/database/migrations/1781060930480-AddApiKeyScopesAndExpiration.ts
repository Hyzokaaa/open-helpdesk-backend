import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApiKeyScopesAndExpiration1781060930480 implements MigrationInterface {
    name = 'AddApiKeyScopesAndExpiration1781060930480'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "api_keys" ADD "scopes" text NOT NULL DEFAULT 'tickets:read,tickets:write,comments:read,comments:write,members:read'`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD "expiresAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "expiresAt"`);
        await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "scopes"`);
    }

}
